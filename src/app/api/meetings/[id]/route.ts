import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { meetingRescheduleHtml } from "@/lib/email-templates";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireUser();
    const item = await get<any>(
      `SELECT m.*, host.full_name as host_name FROM meetings m JOIN users host ON host.id = m.host_id WHERE m.id = :id`,
      { id: params.id }
    );
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const attendees = await all(
      `SELECT u.id, u.full_name, u.email FROM meeting_attendees ma JOIN users u ON u.id = ma.user_id WHERE ma.meeting_id = :id`,
      { id: params.id }
    );
    const history = await all(
      `SELECT h.*, u.full_name as actor_name FROM meeting_history h JOIN users u ON u.id = h.actor_id
       WHERE h.meeting_id = :id ORDER BY h.created_at ASC`,
      { id: params.id }
    );
    return NextResponse.json({ ...item, attendees, history });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// PATCH body: { start_time?, end_time?, location?, agenda?, attendee_ids?, reason }
// Dời lịch họp - chỉ Host (hoặc Super Admin), bắt buộc lý do khi đổi thời gian, tự gửi email thông báo.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const item = await get<any>(`SELECT * FROM meetings WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    if (!(item.host_id === user.id || isSuperAdmin(user.email))) {
      return NextResponse.json({ error: "Chỉ người tổ chức (Host) hoặc Super Admin mới được sửa" }, { status: 403 });
    }
    if (item.status === "cancelled") return NextResponse.json({ error: "Cuộc họp đã bị hủy" }, { status: 400 });

    const timeChanged = (body.start_time && body.start_time !== item.start_time) || (body.end_time && body.end_time !== item.end_time);
    if (timeChanged && !body.reason) {
      return NextResponse.json({ error: "Cần nêu lý do khi dời thời gian họp" }, { status: 400 });
    }

    const allowed = ["title", "start_time", "end_time", "location", "agenda"];
    const sets: string[] = [];
    const values: Record<string, any> = { id: params.id };
    for (const f of allowed) {
      if (f in body) { sets.push(`${f} = :${f}`); values[f] = body[f]; }
    }
    if (timeChanged) sets.push("status = 'rescheduled'");
    if (sets.length > 0) {
      sets.push("updated_at = NOW()");
      await run(`UPDATE meetings SET ${sets.join(", ")} WHERE id = :id`, values);
    }

    if (Array.isArray(body.attendee_ids)) {
      await run(`DELETE FROM meeting_attendees WHERE meeting_id = :id`, { id: params.id });
      for (const uid of body.attendee_ids) {
        await run(`INSERT INTO meeting_attendees (meeting_id, user_id) VALUES (:mid, :uid) ON CONFLICT DO NOTHING`, { mid: params.id, uid });
      }
    }

    await run(
      `INSERT INTO meeting_history (id, meeting_id, action, actor_id, note) VALUES (:id, :mid, :action, :actor, :note)`,
      { id: uuid(), mid: params.id, action: timeChanged ? "rescheduled" : "edited", actor: user.id, note: body.reason ?? null }
    );

    if (timeChanged) {
      const attendees = await all<any>(
        `SELECT u.email FROM meeting_attendees ma JOIN users u ON u.id = ma.user_id WHERE ma.meeting_id = :id`,
        { id: params.id }
      );
      const updated = await get<any>(`SELECT * FROM meetings WHERE id = :id`, { id: params.id });
      await sendEmail({
        to: attendees.map((a) => a.email),
        subject: `[Dời lịch họp] ${updated.title}`,
        html: meetingRescheduleHtml({
          title: updated.title,
          old_start_time: item.start_time,
          new_start_time: updated.start_time,
          new_end_time: updated.end_time,
          location: updated.location,
          reason: body.reason,
        }),
        template: "meeting_reschedule",
        relatedMeetingId: params.id,
      });
      const attendeeIds = await all<any>(`SELECT user_id FROM meeting_attendees WHERE meeting_id = :id`, { id: params.id });
      for (const a of attendeeIds) await notify(a.user_id, "status_change", `Cuộc họp "${updated.title}" đã được dời lịch`, undefined, `/meetings/${params.id}`);
    }

    const updated = await get(`SELECT * FROM meetings WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
