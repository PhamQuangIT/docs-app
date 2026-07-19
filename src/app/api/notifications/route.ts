import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await all(
      `SELECT n.*, wi.title as work_item_title FROM notifications n
       LEFT JOIN work_items wi ON wi.id = n.work_item_id
       WHERE n.user_id = :user_id
       ORDER BY n.created_at DESC LIMIT 50`,
      { user_id: user.id }
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
