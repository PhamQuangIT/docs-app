import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser, canAssign } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { isAssigner, STATUSES } from "@/lib/workflow";
import { v4 as uuid } from "uuid";

// PATCH /api/work-items/:id/assign  body: { owner_id, reason?, deadline? }
// "Điều chỉnh phân công" (mục 5 Thay_đổi.docx) - thay cho nút "Gán việc" cũ.
// - Nếu việc đang ở "draft" (chưa giao cho ai): đây là bước giao việc lần đầu, không bắt buộc lý do.
// - Nếu việc đang ở trạng thái khác (đã có người chịu trách nhiệm): đổi người bắt buộc phải có lý do (mục 1, 8).
// Chỉ Người giao việc của chính việc này (assigned_by_id, hoặc người tạo nếu chưa từng giao chính thức)
// hoặc vai trò toàn cục Quản lý/BGĐ mới được thực hiện.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { owner_id, reason, deadline } = body;
    if (!owner_id) {
      return NextResponse.json({ error: "Thiếu người chịu trách nhiệm chính (owner_id)" }, { status: 400 });
    }

    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    if ([STATUSES.COMPLETED, STATUSES.CANCELLED].includes(item.status)) {
      return NextResponse.json({ error: "Việc đã kết thúc, không thể điều chỉnh phân công" }, { status: 400 });
    }

    if (!(isAssigner(item, user.id) || canAssign(user.roleName))) {
      return NextResponse.json({ error: "Bạn không có quyền điều chỉnh phân công việc này" }, { status: 403 });
    }

    const isFirstAssignment = item.status === STATUSES.DRAFT || !item.owner_id;
    if (!isFirstAssignment && item.owner_id !== owner_id && !reason) {
      return NextResponse.json({ error: "Cần nêu lý do khi đổi người chịu trách nhiệm chính" }, { status: 400 });
    }

    // Từ draft hoặc acceptance_rejected -> giao (lại) sẽ chuyển sang "Chờ tiếp nhận"; các trạng thái khác giữ nguyên
    // (đổi người giữa chừng không bắt người mới phải "tiếp nhận" lại nếu việc đang thực sự chạy - theo bảng mục 6,
    // pending_change_approval chỉ chuyển về in_progress; ở đây xử lý riêng cho thao tác trực tiếp của Người giao việc)
    const newStatus =
      item.status === STATUSES.DRAFT || item.status === STATUSES.ACCEPTANCE_REJECTED
        ? STATUSES.PENDING_ACCEPTANCE
        : item.status;

    await run(
      `UPDATE work_items SET owner_id = :owner_id, assigned_by_id = :assigned_by_id,
       deadline = COALESCE(:deadline, deadline), status = :status, assigned_at = NOW(), updated_at = NOW()
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
        note: isFirstAssignment
          ? `Giao việc cho owner_id=${owner_id}`
          : `Điều chỉnh phân công: owner_id ${item.owner_id ?? "(chưa có)"} -> ${owner_id}. Lý do: ${reason}`,
      }
    );

    await notify(owner_id, "assigned", `Bạn được giao việc: "${item.title}"`, params.id);
    if (!isFirstAssignment && item.owner_id && item.owner_id !== owner_id) {
      await notify(item.owner_id, "assigned", `Bạn không còn là người chịu trách nhiệm việc: "${item.title}"`, params.id);
    }

    const updated = await get(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
