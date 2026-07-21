import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser, canManageUsers } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const rows = await all(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.department_id, u.position_id,
              r.name as role_name, d.name as department_name, p.name as position_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN positions p ON p.id = u.position_id
       ORDER BY u.full_name ASC`
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canManageUsers(user.roleName)) {
      return NextResponse.json({ error: "Chỉ BGĐ được tạo user" }, { status: 403 });
    }
    const body = await req.json();
    const { full_name, email, password, role_id, department_id, position_id, phone } = body;
    if (!full_name || !email || !password || !role_id) {
      return NextResponse.json({ error: "Thiếu trường bắt buộc" }, { status: 400 });
    }
    const existing = await get(`SELECT id FROM users WHERE email = :email`, { email });
    if (existing) return NextResponse.json({ error: "Email đã tồn tại" }, { status: 400 });

    const id = uuid();
    const hash = bcrypt.hashSync(password, 10);
    await run(
      `INSERT INTO users (id, full_name, email, password_hash, phone, role_id, department_id, position_id)
       VALUES (:id, :full_name, :email, :password_hash, :phone, :role_id, :department_id, :position_id)`,
      {
        id, full_name, email, password_hash: hash, phone: phone ?? null,
        role_id, department_id: department_id ?? null, position_id: position_id ?? null,
      }
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
