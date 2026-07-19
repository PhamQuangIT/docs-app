import { NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const rows = await all(`SELECT * FROM positions ORDER BY sort_order ASC, name ASC`);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { name, sort_order } = await req.json();
    if (!name) return NextResponse.json({ error: "Thiếu tên vị trí" }, { status: 400 });

    // Idempotent: nếu vị trí đã tồn tại (VD: người dùng gõ lại tên đã có khi chọn "Khác"), trả về id cũ
    const existing = await get<any>(`SELECT id FROM positions WHERE name = :name`, { name: name.trim() });
    if (existing) return NextResponse.json({ id: existing.id }, { status: 200 });

    const id = uuid();
    await run(`INSERT INTO positions (id, name, sort_order) VALUES (:id, :name, :sort_order)`, {
      id,
      name: name.trim(),
      sort_order: sort_order ?? 50,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
