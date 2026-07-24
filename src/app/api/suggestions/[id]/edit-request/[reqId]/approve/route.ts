import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest, { params }: { params: { id: string; reqId: string } }) {
  try {
    const user = await requireUser();
    const item = await get<any>(`SELECT * FROM suggestions WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    if (!(item.recipient_id === user.id || isSuperAdmin(user.email))) {
      return NextResponse.json({ error: "Chỉ người nhận kiến nghị mới được duyệt đề xuất sửa" }, { status: 403 });
    }
    await run(`UPDATE suggestion_edit_requests SET status = 'approved', reviewed_by = :rb, reviewed_at = NOW() WHERE id = :id`, {
      rb: user.id, id: params.reqId,
    });
    await run(`UPDATE suggestions SET edit_unlocked = TRUE WHERE id = :id`, { id: params.id });
    await run(
      `INSERT INTO suggestion_history (id, suggestion_id, action, actor_id, note) VALUES (:id, :sid, 'edit_request_approved', :actor, NULL)`,
      { id: uuid(), sid: params.id, actor: user.id }
    );
    await notify(item.creator_id, "status_change", `Đề xuất sửa kiến nghị "${item.title}" đã được đồng ý - bạn có thể sửa lại`, undefined, `/suggestions/${params.id}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
