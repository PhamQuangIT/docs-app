import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { notify } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: { id: string; reqId: string } }) {
  try {
    const user = await requireUser();
    const item = await get<any>(`SELECT * FROM suggestions WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    if (!(item.recipient_id === user.id || isSuperAdmin(user.email))) {
      return NextResponse.json({ error: "Chỉ người nhận kiến nghị mới được từ chối đề xuất sửa" }, { status: 403 });
    }
    await run(`UPDATE suggestion_edit_requests SET status = 'rejected', reviewed_by = :rb, reviewed_at = NOW() WHERE id = :id`, {
      rb: user.id, id: params.reqId,
    });
    await notify(item.creator_id, "status_change", `Đề xuất sửa kiến nghị "${item.title}" đã bị từ chối`, undefined, `/suggestions/${params.id}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
