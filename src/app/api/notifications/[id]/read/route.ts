import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    await run(
      `UPDATE notifications SET is_read = true WHERE id = :id AND user_id = :user_id`,
      { id: params.id, user_id: user.id }
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
