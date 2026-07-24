import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

// POST /api/suggestions/:id/edit-request  body: { reason }  - "Đề xuất sửa kiến nghị" khi đã bị khóa
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { reason } = await req.json();
    if (!reason) return NextResponse.json({ error: "Cần nêu lý do muốn sửa" }, { status: 400 });

    const item = await get<any>(`SELECT * FROM suggestions WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    if (item.creator_id !== user.id) return NextResponse.json({ error: "Chỉ người tạo mới được đề xuất sửa" }, { status: 403 });
    if (!item.locked_for_edit) return NextResponse.json({ error: "Kiến nghị chưa bị khóa, có thể sửa trực tiếp" }, { status: 400 });

    const id = uuid();
    await run(
      `INSERT INTO suggestion_edit_requests (id, suggestion_id, requested_by, reason) VALUES (:id, :sid, :requested_by, :reason)`,
      { id, sid: params.id, requested_by: user.id, reason }
    );
    await notify(item.recipient_id, "created", `${user.fullName} đề xuất sửa kiến nghị đã duyệt: "${item.title}"`, undefined, `/suggestions/${params.id}`);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
