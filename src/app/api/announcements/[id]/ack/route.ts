import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

// POST /api/announcements/:id/ack - đánh dấu người dùng hiện tại đã đọc
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    await run(
      `INSERT INTO announcement_reads (id, announcement_id, user_id)
       VALUES (:id, :announcement_id, :user_id)
       ON CONFLICT (announcement_id, user_id) DO NOTHING`,
      { id: uuid(), announcement_id: params.id, user_id: user.id }
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
