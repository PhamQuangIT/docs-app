import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { get } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Thiếu email hoặc mật khẩu" }, { status: 400 });
  }

  const user = await get<any>(
    `SELECT u.*, r.name as role_name FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = :email AND u.is_active = true`,
    { email }
  );

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return NextResponse.json({ error: "Sai email hoặc mật khẩu" }, { status: 401 });
  }

  const token = signSession(user.id);
  setSessionCookie(token);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    roleName: user.role_name,
  });
}
