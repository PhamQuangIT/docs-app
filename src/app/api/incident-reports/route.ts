import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { canActOnIncidentLevel } from "@/lib/incident-workflow";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

// GET /api/incident-reports?scope=mine|pending_me|all
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const scope = req.nextUrl.searchParams.get("scope") ?? "all";

    const base = `
      SELECT ir.*, creator.full_name as creator_name, d.name as department_name,
             gt.title as generated_task_title
      FROM incident_reports ir
      LEFT JOIN users creator ON creator.id = ir.creator_id
      LEFT JOIN departments d ON d.id = ir.department_id
      LEFT JOIN work_items gt ON gt.id = ir.generated_task_id
    `;

    if (scope === "mine") {
      const rows = await all(`${base} WHERE ir.creator_id = :me ORDER BY ir.created_at DESC`, { me: user.id });
      return NextResponse.json(rows);
    }

    if (scope === "pending_me") {
      const rows = await all(`${base} WHERE ir.status LIKE 'pending_%' ORDER BY ir.created_at ASC`);
      const filtered = [];
      for (const r of rows as any[]) {
        if (isSuperAdmin(user.email)) { filtered.push(r); continue; }
        const can = await canActOnIncidentLevel(r.status, r.department_id, user.id, user.roleName, user.positionId ?? null);
        if (can && (!r.department_id || r.department_id === user.departmentId || r.status === "pending_director")) {
          filtered.push(r);
        }
      }
      return NextResponse.json(filtered);
    }

    const rows = await all(`${base} ORDER BY ir.created_at DESC LIMIT 100`);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// POST /api/incident-reports
// body: { title, description, severity, root_cause?, capa?, capa_deadline?, department_id? }
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { title, description, severity, root_cause, capa, capa_deadline, department_id } = body;

    if (!title || !description || !severity) {
      return NextResponse.json({ error: "Thiếu trường bắt buộc: title, description, severity" }, { status: 400 });
    }
    if (!["light", "medium", "serious", "critical"].includes(severity)) {
      return NextResponse.json({ error: "Mức độ sự cố không hợp lệ" }, { status: 400 });
    }

    const id = uuid();
    await run(
      `INSERT INTO incident_reports
       (id, title, description, severity, root_cause, capa, capa_deadline, creator_id, department_id, status)
       VALUES (:id, :title, :description, :severity, :root_cause, :capa, :capa_deadline, :creator_id, :department_id, 'pending_team_lead')`,
      {
        id, title, description, severity,
        root_cause: root_cause ?? null,
        capa: capa ?? null,
        capa_deadline: capa_deadline ?? null,
        creator_id: user.id,
        department_id: department_id ?? user.departmentId ?? null,
      }
    );
    await run(
      `INSERT INTO incident_report_history (id, incident_report_id, from_status, to_status, changed_by, note)
       VALUES (:id, :ir, NULL, 'pending_team_lead', :changed_by, 'Tạo báo cáo sự cố')`,
      { id: uuid(), ir: id, changed_by: user.id }
    );

    // Thông báo cho ai đang giữ chức danh "Trưởng nhóm" trong đúng bộ phận
    const deptId = department_id ?? user.departmentId ?? null;
    if (deptId) {
      const teamLeads = await all<any>(
        `SELECT u.id FROM users u JOIN positions p ON p.id = u.position_id
         WHERE u.department_id = :dept AND p.name ILIKE '%trưởng nhóm%' AND u.is_active = true`,
        { dept: deptId }
      );
      for (const t of teamLeads) {
        await notify(t.id, "created", `Có báo cáo sự cố mới cần duyệt: "${title}"`, undefined, `/incident-reports/${id}`);
      }
    }

    const created = await get(`SELECT * FROM incident_reports WHERE id = :id`, { id });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
