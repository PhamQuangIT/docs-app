import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

const LOCKED_STATUSES = ["approved", "partially_approved", "done"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireUser();
    const item = await get<any>(
      `SELECT s.*, creator.full_name as creator_name, recipient.full_name as recipient_name
       FROM suggestions s JOIN users creator ON creator.id = s.creator_id JOIN users recipient ON recipient.id = s.recipient_id
       WHERE s.id = :id`,
      { id: params.id }
    );
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const history = await all(
      `SELECT h.*, u.full_name as actor_name FROM suggestion_history h JOIN users u ON u.id = h.actor_id
       WHERE h.suggestion_id = :id ORDER BY h.created_at ASC`,
      { id: params.id }
    );
    const editRequests = await all(
      `SELECT er.*, u.full_name as requested_by_name FROM suggestion_edit_requests er JOIN users u ON u.id = er.requested_by
       WHERE er.suggestion_id = :id ORDER BY er.created_at DESC`,
      { id: params.id }
    );
    return NextResponse.json({ ...item, history, editRequests });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// PATCH - người tạo sửa nội dung. Nếu đang khóa (approved/partially_approved/done) và chưa được mở khóa
// (edit_unlocked=false) -> từ chối. Sau khi sửa thành công lúc đang khóa (edit_unlocked=true), quay lại 'pending'
// để cấp trên xem xét lại, và tắt cờ edit_unlocked.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const item = await get<any>(`SELECT * FROM suggestions WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    if (!(item.creator_id === user.id || isSuperAdmin(user.email))) {
      return NextResponse.json({ error: "Chỉ người tạo hoặc Super Admin mới được sửa" }, { status: 403 });
    }
    const isLocked = LOCKED_STATUSES.includes(item.status);
    if (isLocked && !item.edit_unlocked && !isSuperAdmin(user.email)) {
      return NextResponse.json(
        { error: "Kiến nghị đã được duyệt, cần gửi 'Đề xuất sửa kiến nghị' và chờ cấp trên đồng ý trước khi sửa" },
        { status: 403 }
      );
    }

    const allowed = ["title", "content", "reason", "desired_deadline", "recipient_id"];
    const sets: string[] = [];
    const values: Record<string, any> = { id: params.id };
    for (const f of allowed) {
      if (f in body) { sets.push(`${f} = :${f}`); values[f] = body[f]; }
    }
    if (sets.length === 0) return NextResponse.json({ error: "Không có trường nào để cập nhật" }, { status: 400 });

    // Sửa xong sau khi được mở khóa -> quay lại chờ phản hồi, tắt cờ mở khóa, bỏ khóa
    if (isLocked && item.edit_unlocked) {
      sets.push("status = 'pending'", "locked_for_edit = FALSE", "edit_unlocked = FALSE");
    }
    sets.push("updated_at = NOW()");
    await run(`UPDATE suggestions SET ${sets.join(", ")} WHERE id = :id`, values);
    await run(
      `INSERT INTO suggestion_history (id, suggestion_id, action, actor_id, note) VALUES (:id, :sid, 'edited', :actor, NULL)`,
      { id: uuid(), sid: params.id, actor: user.id }
    );

    const updated = await get(`SELECT * FROM suggestions WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
