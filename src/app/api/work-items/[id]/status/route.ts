import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser, canCloseConfirm } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { isTransitionAllowed } from "@/lib/workflow";
import { v4 as uuid } from "uuid";

// PATCH /api/work-items/:id/status  body: { status, note?, reason? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { status: toStatus, note, reason } = body;

    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    const fromStatus = item.status;

    // Reopen từ Closed chỉ trong 48h
    if (fromStatus === "closed" && toStatus === "doing") {
      const closedAt = item.closed_at ? new Date(item.closed_at).getTime() : 0;
      const hoursSince = (Date.now() - closedAt) / 3600000;
      if (hoursSince > 48) {
        return NextResponse.json({ error: "Đã quá 48h kể từ khi đóng, không thể mở lại" }, { status: 400 });
      }
      if (!reason) {
        return NextResponse.json({ error: "Cần nêu lý do khi mở lại việc" }, { status: 400 });
      }
    }

    if (!isTransitionAllowed(fromStatus, toStatus)) {
      return NextResponse.json(
        { error: `Không thể chuyển từ '${fromStatus}' sang '${toStatus}'` },
        { status: 400 }
      );
    }

    // Đóng việc: chỉ Leader/OM/Admin hoặc chính người tạo
    if (toStatus === "closed" && !(canCloseConfirm(user.roleName) || item.creator_id === user.id)) {
      return NextResponse.json({ error: "Bạn không có quyền xác nhận đóng việc" }, { status: 403 });
    }

    if (toStatus === "completed" && !note) {
      return NextResponse.json({ error: "Cần ghi chú kết quả khi hoàn thành việc" }, { status: 400 });
    }

    if (toStatus === "waiting" && !reason) {
      return NextResponse.json({ error: "Cần nêu lý do khi chuyển sang trạng thái Chờ" }, { status: 400 });
    }

    if (toStatus === "cancelled" && !reason) {
      return NextResponse.json({ error: "Cần nêu lý do khi hủy việc" }, { status: 400 });
    }

    const extra: Record<string, any> = {};
    if (toStatus === "completed") extra.completed_at = new Date().toISOString();
    if (toStatus === "closed") extra.closed_at = new Date().toISOString();
    if (toStatus === "waiting") extra.waiting_reason = reason;
    if (toStatus === "cancelled") extra.cancel_reason = reason;
    if (toStatus === "doing" && fromStatus === "closed") extra.closed_at = null; // reopen

    const isOverdueReset = ["completed", "closed", "cancelled"].includes(toStatus) ? false : item.is_overdue;

    const setClauses = [
      "status = :status",
      "is_overdue = :is_overdue",
      "updated_at = NOW()",
      ...Object.keys(extra).map((k) => `${k} = :${k}`),
    ];

    await run(`UPDATE work_items SET ${setClauses.join(", ")} WHERE id = :id`, {
      status: toStatus,
      is_overdue: isOverdueReset,
      id: params.id,
      ...extra,
    });

    await run(
      `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
       VALUES (:id, :wi, :from_status, :to_status, :changed_by, :note)`,
      { id: uuid(), wi: params.id, from_status: fromStatus, to_status: toStatus, changed_by: user.id, note: note ?? reason ?? null }
    );

    // Thông báo cho các bên liên quan
    if (item.creator_id) await notify(item.creator_id, "status_change", `Việc "${item.title}" chuyển sang trạng thái ${toStatus}`, params.id);
    if (item.owner_id && item.owner_id !== user.id) await notify(item.owner_id, "status_change", `Việc "${item.title}" chuyển sang trạng thái ${toStatus}`, params.id);

    const updated = await get(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
