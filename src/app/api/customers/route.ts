import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const rows = await all(`SELECT * FROM customers ORDER BY name ASC`);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const { name, contact_info } = await req.json();
    if (!name) return NextResponse.json({ error: "Thiếu tên khách hàng" }, { status: 400 });
    const id = uuid();
    await run(`INSERT INTO customers (id, name, contact_info) VALUES (:id, :name, :contact_info)`, {
      id,
      name,
      contact_info: contact_info ?? null,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
