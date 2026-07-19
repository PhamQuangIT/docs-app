import { NextResponse } from "next/server";
import { run } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireUser();
    await run(`UPDATE notifications SET is_read = true WHERE user_id = :user_id AND is_read = false`, {
      user_id: user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
