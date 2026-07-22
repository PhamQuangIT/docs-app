import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { canReviewProposal, STATUSES } from "@/lib/workflow";
import { v4 as uuid } from "uuid";

// POST /api/proposals/:id/reject  body: { review_note? }
// - Từ chối đề xuất "complete": việc quay về "Yêu cầu xử lý lại" (mục 6, không mất kết quả đã nộp - mục 8).
// - Từ chối các đề xuất khác (cancel/edit/reassign): việc quay lại "Đang thực hiện", không đổi gì thêm.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { review_note } = body;

    const proposal = await get<any>(`SELECT * FROM work_item_proposals WHERE id = :id`, { id: params.id });
    if (!proposal) return NextResponse.json({ error: "Không tìm thấy đề xuất" }, { status: 404 });
    if (proposal.status !== "pending") {
      return NextResponse.json({ error: "Đề xuất này đã được xử lý trước đó" }, { status: 400 });
    }

    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: proposal.work_item_id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy công việc liên quan" }, { status: 404 });

    if (!canReviewProposal(item, user.id, user.roleName)) {
      return NextResponse.json({ error: "Bạn không có quyền từ chối đề xuất này" }, { status: 403 });
    }

    const toStatus = proposal.type === "complete" ? STATUSES.REWORK_REQUESTED : STATUSES.IN_PROGRESS;
    await run(`UPDATE work_items SET status = :status, updated_at = NOW() WHERE id = :id`, {
      status: toStatus,
      id: item.id,
    });
    await run(
      `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
       VALUES (:id, :wi, :from_status, :to_status, :changed_by, :note)`,
      { id: uuid(), wi: item.id, from_status: item.status, to_status: toStatus, changed_by: user.id, note: `Từ chối đề xuất (${proposal.type})${review_note ? ": " + review_note : ""}` }
    );

    await run(
      `UPDATE work_item_proposals SET status = 'rejected', reviewed_by = :reviewed_by, reviewed_at = NOW(), review_note = :review_note
       WHERE id = :id`,
      { id: params.id, reviewed_by: user.id, review_note: review_note ?? null }
    );

    await notify(proposal.proposed_by, "status_change", `Đề xuất của bạn cho việc "${item.title}" đã bị TỪ CHỐI`, item.id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
