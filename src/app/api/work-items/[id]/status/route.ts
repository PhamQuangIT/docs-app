import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { isTransitionAllowed, isResponsible, canEditWorkItem, STATUSES } from "@/lib/workflow";
import { v4 as uuid } from "uuid";

// PATCH /api/work-items/:id/status  body: { status, note?, reason? }
// Chỉ dùng cho các chuyển trạng thái TRỰC TIẾP (không cần luồng đề xuất/duyệt):
//   draft -> cancelled                (Người tạo / Người giao việc)
//   pending_acceptance -> cancelled   (Người giao việc - Hủy việc trực tiếp, mục 8)
//   in_progress -> rework_requested   (Người giao việc - Yêu cầu xử lý lại trực tiếp, mục 8)
//   in_progress -> cancelled          (Người giao việc - Hủy việc, mục 8)
//   rework_requested -> in_progress   (Người chịu trách nhiệm tiếp tục xử lý, hoặc Người giao việc)
//   rework_requested -> cancelled     (Người giao việc - Hủy việc)
//   completed -> in_progress          (Mở lại trong 48h, quyền quản lý + lý do, mục 8)
// KHÔNG dùng route này cho pending_change_approval / pending_completion_approval - hai trạng thái đó
// chỉ được hệ thống chuyển tự động khi duyệt/từ chối đề xuất (/api/proposals/:id/approve|reject).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { status: toStatus, note, reason } = body;

    if ([STATUSES.PENDING_CHANGE_APPROVAL, STATUSES.PENDING_COMPLETION_APPROVAL].includes(toStatus)) {
      return NextResponse.json(
        { error: "Trạng thái này chỉ được chuyển qua luồng đề xuất (dùng nút Đề nghị... thay vì đổi trạng thái trực tiếp)" },
        { status: 400 }
      );
    }

    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    const fromStatus = item.status;

    // Mở lại từ Hoàn thành chỉ trong 48h
    if (fromStatus === STATUSES.COMPLETED && toStatus === STATUSES.IN_PROGRESS) {
      const completedAt = item.closed_at ? new Date(item.closed_at).getTime() : 0;
      const hoursSince = (Date.now() - completedAt) / 3600000;
      if (hoursSince > 48) {
        return NextResponse.json({ error: "Đã quá 48h kể từ khi hoàn thành, không thể mở lại" }, { status: 400 });
      }
      if (!reason) {
        return NextResponse.json({ error: "Cần nêu lý do khi mở lại việc" }, { status: 400 });
      }
      if (!canEditWorkItem(item, user.id, user.email, isSuperAdmin)) {
        return NextResponse.json({ error: "Chỉ người tạo/người giao việc của việc này (hoặc Super Admin) mới có quyền mở lại" }, { status: 403 });
      }
    }

    if (!isTransitionAllowed(fromStatus, toStatus)) {
      return NextResponse.json(
        { error: `Không thể chuyển từ '${fromStatus}' sang '${toStatus}'` },
        { status: 400 }
      );
    }

    // Hủy việc: chỉ Người tạo/Người giao việc của việc này (hoặc Super Admin), bắt buộc lý do (mục 8)
    if (toStatus === STATUSES.CANCELLED && !canEditWorkItem(item, user.id, user.email, isSuperAdmin)) {
      return NextResponse.json({ error: "Chỉ người tạo/người giao việc của việc này (hoặc Super Admin) mới có quyền hủy việc" }, { status: 403 });
    }
    if (toStatus === STATUSES.CANCELLED && !reason) {
      return NextResponse.json({ error: "Cần nêu lý do khi hủy việc" }, { status: 400 });
    }

    // Yêu cầu xử lý lại trực tiếp: chỉ Người tạo/Người giao việc của việc này (hoặc Super Admin), bắt buộc lý do (mục 8)
    if (toStatus === STATUSES.REWORK_REQUESTED) {
      if (!canEditWorkItem(item, user.id, user.email, isSuperAdmin)) {
        return NextResponse.json({ error: "Chỉ người tạo/người giao việc của việc này (hoặc Super Admin) mới có quyền yêu cầu xử lý lại" }, { status: 403 });
      }
      if (!reason) {
        return NextResponse.json({ error: "Cần nêu lý do khi yêu cầu xử lý lại" }, { status: 400 });
      }
    }

    // Tiếp tục xử lý sau "Yêu cầu xử lý lại": Người chịu trách nhiệm (việc của chính họ) hoặc Người tạo/Người
    // giao việc/Super Admin - KHÔNG mở rộng cho Quản lý/BGĐ nói chung nữa.
    if (fromStatus === STATUSES.REWORK_REQUESTED && toStatus === STATUSES.IN_PROGRESS) {
      if (!(isResponsible(item, user.id) || canEditWorkItem(item, user.id, user.email, isSuperAdmin))) {
        return NextResponse.json({ error: "Bạn không có quyền chuyển tiếp việc này" }, { status: 403 });
      }
    }

    const extra: Record<string, any> = {};
    if (toStatus === STATUSES.COMPLETED) extra.completed_at = new Date().toISOString();
    if (toStatus === STATUSES.CANCELLED) extra.cancel_reason = reason;
    if (toStatus === STATUSES.IN_PROGRESS && fromStatus === STATUSES.COMPLETED) extra.closed_at = null; // reopen

    const isOverdueReset = [STATUSES.COMPLETED, STATUSES.CANCELLED].includes(toStatus) ? false : item.is_overdue;

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

    if (item.creator_id) await notify(item.creator_id, "status_change", `Việc "${item.title}" chuyển sang trạng thái ${toStatus}`, params.id);
    if (item.owner_id && item.owner_id !== user.id) await notify(item.owner_id, "status_change", `Việc "${item.title}" chuyển sang trạng thái ${toStatus}`, params.id);

    const updated = await get(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
