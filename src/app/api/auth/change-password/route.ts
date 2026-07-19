import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { current_password, new_password } = await req.json();
    if (!current_password || !new_password) {
      return NextResponse.json({ error: "Thiếu mật khẩu hiện tại hoặc mật khẩu mới" }, { status: 400 });
    }
    if (new_password.length < 6) {
      return NextResponse.json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" }, { status: 400 });
    }

    const row = await get<any>(`SELECT password_hash FROM users WHERE id = :id`, { id: user.id });
    if (!row || !bcrypt.compareSync(current_password, row.password_hash)) {
      return NextResponse.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
    }

    const newHash = bcrypt.hashSync(new_password, 10);
    await run(`UPDATE users SET password_hash = :hash, updated_at = NOW() WHERE id = :id`, {
      hash: newHash,
      id: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
