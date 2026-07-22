import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { isResponsible, isTransitionAllowed, STATUSES } from "@/lib/workflow";
import { v4 as uuid } from "uuid";

// POST /api/work-items/:id/reject-acceptance  body: { reason }
// Chỉ Người chịu trách nhiệm chính, bắt buộc lý do, chỉ được làm TRƯỚC KHI bắt đầu xử lý (mục 8).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { reason } = body;
    if (!reason) {
      return NextResponse.json({ error: "Cần nêu lý do khi từ chối tiếp nhận" }, { status: 400 });
    }

    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    if (!isResponsible(item, user.id)) {
      return NextResponse.json({ error: "Chỉ người chịu trách nhiệm chính mới từ chối tiếp nhận được" }, { status: 403 });
    }
    if (!isTransitionAllowed(item.status, STATUSES.ACCEPTANCE_REJECTED)) {
      return NextResponse.json({ error: `Không thể từ chối tiếp nhận khi việc đang ở trạng thái '${item.status}'` }, { status: 400 });
    }

    await run(
      `UPDATE work_items SET status = :status, updated_at = NOW() WHERE id = :id`,
      { status: STATUSES.ACCEPTANCE_REJECTED, id: params.id }
    );
    await run(
      `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
       VALUES (:id, :wi, :from_status, :to_status, :changed_by, :note)`,
      { id: uuid(), wi: params.id, from_status: item.status, to_status: STATUSES.ACCEPTANCE_REJECTED, changed_by: user.id, note: reason }
    );

    const assignerId = item.assigned_by_id || item.creator_id;
    if (assignerId) await notify(assignerId, "status_change", `${user.fullName} đã TỪ CHỐI tiếp nhận việc "${item.title}": ${reason}`, params.id);

    const updated = await get(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
