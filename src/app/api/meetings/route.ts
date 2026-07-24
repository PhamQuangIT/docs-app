import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { meetingInviteHtml } from "@/lib/email-templates";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const scope = req.nextUrl.searchParams.get("scope") ?? "upcoming";
    const base = `SELECT m.*, host.full_name as host_name FROM meetings m JOIN users host ON host.id = m.host_id`;
    if (scope === "mine") {
      return NextResponse.json(
        await all(
          `${base} WHERE m.host_id = :me OR EXISTS (SELECT 1 FROM meeting_attendees ma WHERE ma.meeting_id = m.id AND ma.user_id = :me)
           ORDER BY m.start_time ASC`,
          { me: user.id }
        )
      );
    }
    return NextResponse.json(await all(`${base} WHERE m.status != 'cancelled' ORDER BY m.start_time ASC LIMIT 100`));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// POST body: { title, meeting_type, start_time, end_time, location?, agenda?, attendee_ids: string[] }
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { title, meeting_type, start_time, end_time, location, agenda, attendee_ids } = body;
    if (!title || !meeting_type || !start_time || !end_time) {
      return NextResponse.json({ error: "Thiếu trường bắt buộc" }, { status: 400 });
    }
    const validTypes = ["team", "production_direct", "production_indirect", "department", "board"];
    if (!validTypes.includes(meeting_type)) return NextResponse.json({ error: "Loại họp không hợp lệ" }, { status: 400 });

    const id = uuid();
    await run(
      `INSERT INTO meetings (id, title, meeting_type, start_time, end_time, location, agenda, host_id)
       VALUES (:id, :title, :meeting_type, :start_time, :end_time, :location, :agenda, :host_id)`,
      { id, title, meeting_type, start_time, end_time, location: location ?? null, agenda: agenda ?? null, host_id: user.id }
    );
    const attendees: string[] = Array.isArray(attendee_ids) ? attendee_ids : [];
    for (const uid of attendees) {
      await run(`INSERT INTO meeting_attendees (meeting_id, user_id) VALUES (:mid, :uid) ON CONFLICT DO NOTHING`, { mid: id, uid });
    }
    await run(`INSERT INTO meeting_history (id, meeting_id, action, actor_id, note) VALUES (:id, :mid, 'created', :actor, NULL)`, {
      id: uuid(), mid: id, actor: user.id,
    });

    // Gửi email mời họp tới toàn bộ người tham dự (không chặn phản hồi API nếu gửi mail lỗi/bỏ qua)
    if (attendees.length > 0) {
      const rows = await all<any>(`SELECT email FROM users WHERE id = ANY(:ids)`, { ids: attendees });
      const emails = rows.map((r) => r.email);
      await sendEmail({
        to: emails,
        subject: `[Thư mời họp] ${title}`,
        html: meetingInviteHtml({ title, meeting_type, start_time, end_time, location, agenda, host_name: user.fullName }),
        template: "meeting_invite",
        relatedMeetingId: id,
      });
      for (const uid of attendees) {
        await notify(uid, "created", `Bạn được mời họp: "${title}"`, undefined, `/meetings/${id}`);
      }
    }

    const created = await get(`SELECT * FROM meetings WHERE id = :id`, { id });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
