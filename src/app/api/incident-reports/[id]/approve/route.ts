import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { canActOnIncidentLevel, nextIncidentStatus, levelLabel } from "@/lib/incident-workflow";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

// POST /api/incident-reports/:id/approve  body: { note? }
// Duyệt đúng cấp hiện tại -> chuyển sang cấp kế tiếp (hoặc 'approved' nếu là cấp cuối Giám đốc/Trợ lý GĐ).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const item = await get<any>(`SELECT * FROM incident_reports WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    if (!item.status.startsWith("pending_")) {
      return NextResponse.json({ error: "Báo cáo không ở trạng thái chờ duyệt" }, { status: 400 });
    }

    const allowed =
      isSuperAdmin(user.email) ||
      (await canActOnIncidentLevel(item.status, item.department_id, user.id, user.roleName, user.positionId ?? null));
    if (!allowed) {
      return NextResponse.json({ error: `Chỉ ${levelLabel(item.status)} (hoặc Super Admin) mới được duyệt ở cấp này` }, { status: 403 });
    }

    const toStatus = nextIncidentStatus(item.status);
    await run(`UPDATE incident_reports SET status = :status, updated_at = NOW() WHERE id = :id`, {
      status: toStatus, id: params.id,
    });
    await run(
      `INSERT INTO incident_report_history (id, incident_report_id, from_status, to_status, changed_by, note)
       VALUES (:id, :ir, :from_status, :to_status, :changed_by, :note)`,
      { id: uuid(), ir: params.id, from_status: item.status, to_status: toStatus, changed_by: user.id, note: body.note ?? null }
    );

    await notify(item.creator_id, "status_change", `Báo cáo sự cố "${item.title}" đã được duyệt qua cấp ${levelLabel(item.status)}`, undefined, `/incident-reports/${params.id}`);

    const updated = await get(`SELECT * FROM incident_reports WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
