import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser, canManageUsers } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const rows = await all(
      `SELECT d.*, p.name as parent_name FROM departments d
       LEFT JOIN departments p ON p.id = d.parent_id
       ORDER BY d.name ASC`
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
      return NextResponse.json({ error: "Chỉ Admin được tạo phòng ban" }, { status: 403 });
    }
    const { name, parent_id } = await req.json();
    if (!name) return NextResponse.json({ error: "Thiếu tên phòng ban" }, { status: 400 });
    const id = uuid();
    await run(`INSERT INTO departments (id, name, parent_id) VALUES (:id, :name, :parent_id)`, {
      id,
      name,
      parent_id: parent_id ?? null,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
