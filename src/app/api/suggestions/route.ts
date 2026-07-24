import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const scope = req.nextUrl.searchParams.get("scope") ?? "all";
    const base = `
      SELECT s.*, creator.full_name as creator_name, recipient.full_name as recipient_name
      FROM suggestions s
      JOIN users creator ON creator.id = s.creator_id
      JOIN users recipient ON recipient.id = s.recipient_id
    `;
    if (scope === "mine") {
      return NextResponse.json(await all(`${base} WHERE s.creator_id = :me ORDER BY s.created_at DESC`, { me: user.id }));
    }
    if (scope === "pending_me") {
      return NextResponse.json(
        await all(`${base} WHERE s.recipient_id = :me AND s.status IN ('pending','need_more_info') ORDER BY s.created_at ASC`, { me: user.id })
      );
    }
    return NextResponse.json(await all(`${base} ORDER BY s.created_at DESC LIMIT 100`));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// POST body: { title, content, reason, desired_deadline, recipient_id }
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { title, content, reason, desired_deadline, recipient_id } = await req.json();
    if (!title || !content || !reason || !desired_deadline || !recipient_id) {
      return NextResponse.json({ error: "Thiếu trường bắt buộc" }, { status: 400 });
    }
    const id = uuid();
    await run(
      `INSERT INTO suggestions (id, title, content, reason, desired_deadline, creator_id, recipient_id)
       VALUES (:id, :title, :content, :reason, :desired_deadline, :creator_id, :recipient_id)`,
      { id, title, content, reason, desired_deadline, creator_id: user.id, recipient_id }
    );
    await run(
      `INSERT INTO suggestion_history (id, suggestion_id, action, actor_id, note) VALUES (:id, :sid, 'created', :actor, NULL)`,
      { id: uuid(), sid: id, actor: user.id }
    );
    await notify(recipient_id, "created", `${user.fullName} gửi kiến nghị mới: "${title}"`, undefined, `/suggestions/${id}`);
    const created = await get(`SELECT * FROM suggestions WHERE id = :id`, { id });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
