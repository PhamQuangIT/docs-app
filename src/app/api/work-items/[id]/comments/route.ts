import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireUser();
    const rows = await all(
      `SELECT wc.*, u.full_name as user_name FROM work_item_comments wc
       JOIN users u ON u.id = wc.user_id
       WHERE wc.work_item_id = :id ORDER BY wc.created_at ASC`,
      { id: params.id }
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { content } = await req.json();
    if (!content) return NextResponse.json({ error: "Thiếu nội dung" }, { status: 400 });

    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    const id = uuid();
    await run(
      `INSERT INTO work_item_comments (id, work_item_id, user_id, content)
       VALUES (:id, :wi, :user_id, :content)`,
      { id, wi: params.id, user_id: user.id, content }
    );

    // Thông báo cho những người liên quan (trừ người vừa comment)
    const watchers = new Set([item.creator_id, item.owner_id].filter(Boolean));
    watchers.delete(user.id);
    for (const w of watchers) await notify(w as string, "comment", `${user.fullName} vừa bình luận trên "${item.title}"`, params.id);

    const created = await get(
      `SELECT wc.*, u.full_name as user_name FROM work_item_comments wc
       JOIN users u ON u.id = wc.user_id WHERE wc.id = :id`,
      { id }
    );
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
