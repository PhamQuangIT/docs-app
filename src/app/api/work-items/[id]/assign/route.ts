import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser, canAssign } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

// PATCH /api/work-items/:id/assign  body: { owner_id, deadline? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canAssign(user.roleName)) {
      return NextResponse.json({ error: "Bạn không có quyền gán việc" }, { status: 403 });
    }
    const body = await req.json();
    const { owner_id, deadline } = body;
    if (!owner_id) {
      return NextResponse.json({ error: "Thiếu owner_id" }, { status: 400 });
    }

    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    if (item.status === "closed" || item.status === "cancelled") {
      return NextResponse.json({ error: "Việc đã đóng/hủy, không thể gán lại" }, { status: 400 });
    }

    const newStatus = item.status === "new" ? "assigned" : item.status;

    await run(
      `UPDATE work_items SET owner_id = :owner_id, assigned_by_id = :assigned_by_id, deadline = COALESCE(:deadline, deadline),
       status = :status, assigned_at = NOW(), updated_at = NOW()
       WHERE id = :id`,
      { owner_id, assigned_by_id: user.id, deadline: deadline ?? null, status: newStatus, id: params.id }
    );

    await run(
      `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
       VALUES (:id, :wi, :from_status, :to_status, :changed_by, :note)`,
      {
        id: uuid(),
        wi: params.id,
        from_status: item.status,
        to_status: newStatus,
        changed_by: user.id,
        note: `Gán cho owner_id=${owner_id}`,
      }
    );

    await notify(owner_id, "assigned", `Bạn được giao việc: "${item.title}"`, params.id);

    const updated = await get(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
