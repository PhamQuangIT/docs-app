import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

const LOCKED_STATUSES = ["approved", "partially_approved", "done"];
const ACTION_LABEL: Record<string, string> = {
  reject: "Từ chối",
  approve: "Chấp thuận / Đồng ý thực hiện",
  partial_approve: "Chấp thuận một phần",
  need_more_info: "Yêu cầu bổ sung thông tin",
  escalate: "Chuyển cho cấp cao hơn",
  mark_done: "Đã thực hiện / Đã hoàn thành",
  note_for_future: "Ghi nhận để nghiên cứu trong tương lai",
};

// POST /api/suggestions/:id/respond
// body: { action, reject_reason?, partial_note?, response_note?, escalated_to_id? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { action } = body;
    if (!ACTION_LABEL[action]) return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });

    const item = await get<any>(`SELECT * FROM suggestions WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    if (!(item.recipient_id === user.id || isSuperAdmin(user.email))) {
      return NextResponse.json({ error: "Chỉ người nhận kiến nghị (hoặc Super Admin) mới được phản hồi" }, { status: 403 });
    }
    if (!["pending", "need_more_info"].includes(item.status)) {
      return NextResponse.json({ error: "Kiến nghị này không ở trạng thái chờ phản hồi" }, { status: 400 });
    }

    const sets: string[] = ["responded_by = :responded_by", "responded_at = NOW()", "updated_at = NOW()"];
    const values: Record<string, any> = { id: params.id, responded_by: user.id };
    let newRecipientId = item.recipient_id;

    if (action === "reject") {
      if (!body.reject_reason) return NextResponse.json({ error: "Cần nêu nguyên nhân từ chối" }, { status: 400 });
      sets.push("status = 'rejected'", "reject_reason = :reject_reason");
      values.reject_reason = body.reject_reason;
    } else if (action === "approve") {
      sets.push("status = 'approved'", "locked_for_edit = TRUE");
    } else if (action === "partial_approve") {
      if (!body.partial_note) return NextResponse.json({ error: "Cần nhập nội dung được chấp thuận" }, { status: 400 });
      sets.push("status = 'partially_approved'", "partial_note = :partial_note", "locked_for_edit = TRUE");
      values.partial_note = body.partial_note;
    } else if (action === "need_more_info") {
      sets.push("status = 'need_more_info'", "response_note = :response_note");
      values.response_note = body.response_note ?? null;
    } else if (action === "escalate") {
      if (!body.escalated_to_id) return NextResponse.json({ error: "Cần chọn người nhận ở cấp cao hơn" }, { status: 400 });
      sets.push("status = 'pending'", "recipient_id = :recipient_id");
      values.recipient_id = body.escalated_to_id;
      newRecipientId = body.escalated_to_id;
    } else if (action === "mark_done") {
      sets.push("status = 'done'", "locked_for_edit = TRUE");
    } else if (action === "note_for_future") {
      sets.push("status = 'noted_for_future'");
    }

    await run(`UPDATE suggestions SET ${sets.join(", ")} WHERE id = :id`, values);
    await run(
      `INSERT INTO suggestion_history (id, suggestion_id, action, actor_id, note) VALUES (:id, :sid, :action, :actor, :note)`,
      { id: uuid(), sid: params.id, action, actor: user.id, note: body.reject_reason ?? body.partial_note ?? body.response_note ?? null }
    );

    if (action === "escalate") {
      await notify(newRecipientId, "created", `Kiến nghị được chuyển tiếp cho bạn: "${item.title}"`, undefined, `/suggestions/${params.id}`);
      await notify(item.creator_id, "status_change", `Kiến nghị "${item.title}" đã được chuyển cho cấp cao hơn`, undefined, `/suggestions/${params.id}`);
    } else {
      await notify(item.creator_id, "status_change", `Kiến nghị "${item.title}" - phản hồi: ${ACTION_LABEL[action]}`, undefined, `/suggestions/${params.id}`);
    }

    const updated = await get(`SELECT * FROM suggestions WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
