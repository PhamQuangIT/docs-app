import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { canReviewProposal } from "@/lib/workflow";
import { v4 as uuid } from "uuid";

// POST /api/proposals/:id/approve  body: { review_note? }
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
      return NextResponse.json({ error: "Bạn không có quyền duyệt đề xuất này" }, { status: 403 });
    }

    // Áp dụng hiệu lực thật theo loại đề xuất
    if (proposal.type === "complete") {
      await run(
        `UPDATE work_items SET status = 'closed', completed_at = NOW(), closed_at = NOW(), updated_at = NOW()
         WHERE id = :id`,
        { id: item.id }
      );
      await run(
        `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
         VALUES (:id, :wi, :from_status, 'closed', :changed_by, :note)`,
        { id: uuid(), wi: item.id, from_status: item.status, changed_by: user.id, note: `Duyệt đề xuất hoàn thành: ${proposal.note ?? ""}` }
      );
    } else if (proposal.type === "cancel") {
      await run(
        `UPDATE work_items SET status = 'cancelled', cancel_reason = :reason, updated_at = NOW()
         WHERE id = :id`,
        { id: item.id, reason: proposal.note ?? "Duyệt đề xuất hủy việc" }
      );
      await run(
        `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
         VALUES (:id, :wi, :from_status, 'cancelled', :changed_by, :note)`,
        { id: uuid(), wi: item.id, from_status: item.status, changed_by: user.id, note: `Duyệt đề xuất hủy: ${proposal.note ?? ""}` }
      );
    } else if (proposal.type === "edit") {
      const sets: string[] = ["updated_at = NOW()"];
      const values: Record<string, any> = { id: item.id };
      if (proposal.proposed_title) { sets.push("title = :title"); values.title = proposal.proposed_title; }
      if (proposal.proposed_description) { sets.push("description = :description"); values.description = proposal.proposed_description; }
      if (proposal.proposed_deadline) { sets.push("deadline = :deadline"); values.deadline = proposal.proposed_deadline; }
      await run(`UPDATE work_items SET ${sets.join(", ")} WHERE id = :id`, values);
      await run(
        `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
         VALUES (:id, :wi, :status, :status, :changed_by, :note)`,
        { id: uuid(), wi: item.id, status: item.status, changed_by: user.id, note: `Duyệt đề xuất sửa nội dung/hạn: ${proposal.note ?? ""}` }
      );
    }

    await run(
      `UPDATE work_item_proposals SET status = 'approved', reviewed_by = :reviewed_by, reviewed_at = NOW(), review_note = :review_note
       WHERE id = :id`,
      { id: params.id, reviewed_by: user.id, review_note: review_note ?? null }
    );

    await notify(proposal.proposed_by, "status_change", `Đề xuất của bạn cho việc "${item.title}" đã được DUYỆT`, item.id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
