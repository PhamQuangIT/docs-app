import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

// PATCH /api/work-items/:id/escalate  body: { escalated_to, reason }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { escalated_to, reason } = body;
    if (!escalated_to || !reason) {
      return NextResponse.json({ error: "Thiếu escalated_to hoặc reason" }, { status: 400 });
    }

    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    await run(
      `INSERT INTO escalations (id, work_item_id, escalated_from, escalated_to, reason, is_auto)
       VALUES (:id, :wi, :from_user, :to_user, :reason, false)`,
      { id: uuid(), wi: params.id, from_user: user.id, to_user: escalated_to, reason }
    );

    await notify(escalated_to, "escalation", `Việc "${item.title}" được escalate cho bạn: ${reason}`, params.id);

    const escalations = await get(
      `SELECT COUNT(*)::int as cnt FROM escalations WHERE work_item_id = :id`,
      { id: params.id }
    );

    return NextResponse.json({ ok: true, escalations });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
