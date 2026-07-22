import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser, canAssign } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { isResponsible, isAssigner, STATUSES } from "@/lib/workflow";
import { v4 as uuid } from "uuid";

// POST /api/work-items/:id/propose
// body: { type: 'complete'|'cancel'|'edit'|'reassign', note?, proposed_title?, proposed_description?,
//         proposed_deadline?, proposed_owner_id? }
//
// Quyền đề xuất theo mục 7 Thay_đổi.docx:
// - complete / cancel / edit : Người chịu trách nhiệm chính HOẶC Người giao việc
// - reassign (giao lại/đổi người) : chỉ Người giao việc (hoặc Quản lý/BGĐ)
//
// "Đề xuất không làm thay đổi dữ liệu chính ngay lập tức": trong lúc chờ duyệt, việc chuyển sang trạng thái
// "Chờ duyệt hoàn thành" (complete) hoặc "Chờ duyệt thay đổi" (cancel/edit/reassign) - chỉ cho phép khi
// việc đang "Đang thực hiện" và CHƯA có đề xuất nào khác đang mở (mục 10: 1 đề xuất mở tại 1 thời điểm).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { type, note, proposed_title, proposed_description, proposed_deadline, proposed_owner_id } = body;

    if (!["complete", "cancel", "edit", "reassign"].includes(type)) {
      return NextResponse.json({ error: "Loại đề xuất không hợp lệ" }, { status: 400 });
    }

    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    if (item.status !== STATUSES.IN_PROGRESS) {
      return NextResponse.json(
        { error: "Chỉ có thể tạo đề xuất khi việc đang ở trạng thái 'Đang thực hiện'" },
        { status: 400 }
      );
    }

    const existingOpen = await get<any>(
      `SELECT id FROM work_item_proposals WHERE work_item_id = :wi AND status = 'pending'`,
      { wi: params.id }
    );
    if (existingOpen) {
      return NextResponse.json({ error: "Việc này đang có 1 đề xuất khác chờ duyệt, cần xử lý xong trước" }, { status: 400 });
    }

    if (type === "reassign") {
      if (!(isAssigner(item, user.id) || canAssign(user.roleName))) {
        return NextResponse.json({ error: "Chỉ người giao việc mới được đề xuất giao lại người khác" }, { status: 403 });
      }
      if (!proposed_owner_id) {
        return NextResponse.json({ error: "Thiếu người được đề xuất giao lại (proposed_owner_id)" }, { status: 400 });
      }
    } else {
      // complete/cancel/edit: chỉ Người chịu trách nhiệm chính đề xuất (Người giao việc có thao tác trực tiếp riêng
      // - Sửa việc, Hủy việc, Yêu cầu xử lý lại - không cần qua đề xuất vì họ đã là người quyết định, mục 8)
      if (!isResponsible(item, user.id)) {
        return NextResponse.json(
          { error: "Chỉ người chịu trách nhiệm chính mới được tạo đề xuất này" },
          { status: 403 }
        );
      }
    }

    if (type === "edit" && !proposed_title && !proposed_description && !proposed_deadline) {
      return NextResponse.json({ error: "Cần nhập ít nhất 1 nội dung muốn sửa" }, { status: 400 });
    }

    const id = uuid();
    await run(
      `INSERT INTO work_item_proposals
       (id, work_item_id, type, proposed_by, note, proposed_title, proposed_description, proposed_deadline, proposed_owner_id)
       VALUES (:id, :work_item_id, :type, :proposed_by, :note, :proposed_title, :proposed_description, :proposed_deadline, :proposed_owner_id)`,
      {
        id,
        work_item_id: params.id,
        type,
        proposed_by: user.id,
        note: note ?? null,
        proposed_title: proposed_title ?? null,
        proposed_description: proposed_description ?? null,
        proposed_deadline: proposed_deadline ?? null,
        proposed_owner_id: proposed_owner_id ?? null,
      }
    );

    // Chuyển trạng thái tương ứng trong lúc chờ duyệt (mục 6, 7)
    const nextStatus = type === "complete" ? STATUSES.PENDING_COMPLETION_APPROVAL : STATUSES.PENDING_CHANGE_APPROVAL;
    await run(`UPDATE work_items SET status = :status, updated_at = NOW() WHERE id = :id`, {
      status: nextStatus,
      id: params.id,
    });
    await run(
      `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
       VALUES (:id, :wi, :from_status, :to_status, :changed_by, :note)`,
      {
        id: uuid(),
        wi: params.id,
        from_status: item.status,
        to_status: nextStatus,
        changed_by: user.id,
        note: `Tạo đề xuất (${type})${note ? ": " + note : ""}`,
      }
    );

    const typeLabel =
      type === "complete" ? "hoàn thành" : type === "cancel" ? "hủy" : type === "reassign" ? "giao lại người khác" : "sửa nội dung/hạn";
    const reviewerId = item.assigned_by_id || item.creator_id;
    if (reviewerId && reviewerId !== user.id) {
      await notify(reviewerId, "status_change", `${user.fullName} đề nghị ${typeLabel} việc "${item.title}"`, params.id);
    }

    return NextResponse.json({ id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
