import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { isResponsible, isTransitionAllowed, STATUSES } from "@/lib/workflow";
import { v4 as uuid } from "uuid";

// POST /api/work-items/:id/accept
// Chỉ Người chịu trách nhiệm chính được "Tiếp nhận" việc (mục 5, 6) - chuyển Chờ tiếp nhận -> Đang thực hiện.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    if (!isResponsible(item, user.id)) {
      return NextResponse.json({ error: "Chỉ người chịu trách nhiệm chính mới tiếp nhận được việc này" }, { status: 403 });
    }
    if (!isTransitionAllowed(item.status, STATUSES.IN_PROGRESS)) {
      return NextResponse.json({ error: `Không thể tiếp nhận việc đang ở trạng thái '${item.status}'` }, { status: 400 });
    }

    await run(
      `UPDATE work_items SET status = :status, updated_at = NOW() WHERE id = :id`,
      { status: STATUSES.IN_PROGRESS, id: params.id }
    );
    await run(
      `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
       VALUES (:id, :wi, :from_status, :to_status, :changed_by, 'Tiếp nhận việc')`,
      { id: uuid(), wi: params.id, from_status: item.status, to_status: STATUSES.IN_PROGRESS, changed_by: user.id }
    );

    const assignerId = item.assigned_by_id || item.creator_id;
    if (assignerId) await notify(assignerId, "status_change", `${user.fullName} đã tiếp nhận việc "${item.title}"`, params.id);

    const updated = await get(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
