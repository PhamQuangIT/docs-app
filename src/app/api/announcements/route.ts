import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

// GET /api/announcements - danh sách tất cả, kèm cờ is_read theo user hiện tại
export async function GET() {
  try {
    const user = await requireUser();
    const rows = await all(
      `SELECT a.*, u.full_name as created_by_name,
              (ar.id IS NOT NULL) as is_read
       FROM announcements a
       JOIN users u ON u.id = a.created_by
       LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = :user_id
       ORDER BY a.created_at DESC`,
      { user_id: user.id }
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// POST /api/announcements - ai đăng nhập cũng tạo được
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { title, content } = await req.json();
    if (!title || !content) {
      return NextResponse.json({ error: "Thiếu tiêu đề hoặc nội dung" }, { status: 400 });
    }
    const id = uuid();
    await run(
      `INSERT INTO announcements (id, title, content, created_by) VALUES (:id, :title, :content, :created_by)`,
      { id, title, content, created_by: user.id }
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
