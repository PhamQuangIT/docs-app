import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { meetingCancelHtml } from "@/lib/email-templates";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

// POST /api/meetings/:id/cancel  body: { reason }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { reason } = await req.json();
    if (!reason) return NextResponse.json({ error: "Cần nêu lý do hủy họp" }, { status: 400 });

    const item = await get<any>(`SELECT * FROM meetings WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    if (!(item.host_id === user.id || isSuperAdmin(user.email))) {
      return NextResponse.json({ error: "Chỉ người tổ chức (Host) hoặc Super Admin mới được hủy" }, { status: 403 });
    }
    if (item.status === "cancelled") return NextResponse.json({ error: "Cuộc họp đã bị hủy trước đó" }, { status: 400 });

    await run(`UPDATE meetings SET status = 'cancelled', cancel_reason = :reason, updated_at = NOW() WHERE id = :id`, {
      reason, id: params.id,
    });
    await run(`INSERT INTO meeting_history (id, meeting_id, action, actor_id, note) VALUES (:id, :mid, 'cancelled', :actor, :note)`, {
      id: uuid(), mid: params.id, actor: user.id, note: reason,
    });

    const attendees = await all<any>(
      `SELECT u.id, u.email FROM meeting_attendees ma JOIN users u ON u.id = ma.user_id WHERE ma.meeting_id = :id`,
      { id: params.id }
    );
    await sendEmail({
      to: attendees.map((a) => a.email),
      subject: `[Hủy họp] ${item.title}`,
      html: meetingCancelHtml({ title: item.title, start_time: item.start_time, reason }),
      template: "meeting_cancel",
      relatedMeetingId: params.id,
    });
    for (const a of attendees) await notify(a.id, "status_change", `Cuộc họp "${item.title}" đã bị HỦY: ${reason}`, undefined, `/meetings/${params.id}`);

    const updated = await get(`SELECT * FROM meetings WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
