import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireUser();
    const item = await get<any>(
      `SELECT ir.*, creator.full_name as creator_name, d.name as department_name,
              gt.title as generated_task_title, gt.id as generated_task_id
       FROM incident_reports ir
       LEFT JOIN users creator ON creator.id = ir.creator_id
       LEFT JOIN departments d ON d.id = ir.department_id
       LEFT JOIN work_items gt ON gt.id = ir.generated_task_id
       WHERE ir.id = :id`,
      { id: params.id }
    );
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    const history = await all(
      `SELECT h.*, u.full_name as changed_by_name FROM incident_report_history h
       JOIN users u ON u.id = h.changed_by WHERE h.incident_report_id = :id ORDER BY h.created_at ASC`,
      { id: params.id }
    );
    const attachments = await all(`SELECT * FROM incident_report_attachments WHERE incident_report_id = :id`, { id: params.id });
    return NextResponse.json({ ...item, history, attachments });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// PATCH - chỉ người tạo được sửa, và chỉ khi còn ở cấp duyệt đầu tiên (chưa ai duyệt) hoặc Super Admin
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const item = await get<any>(`SELECT * FROM incident_reports WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    if (!(item.creator_id === user.id || isSuperAdmin(user.email))) {
      return NextResponse.json({ error: "Chỉ người tạo hoặc Super Admin mới được sửa" }, { status: 403 });
    }
    if (item.status !== "pending_team_lead" && !isSuperAdmin(user.email)) {
      return NextResponse.json({ error: "Báo cáo đã được duyệt ở cấp tiếp theo, không thể sửa nữa" }, { status: 400 });
    }

    const allowed = ["title", "description", "severity", "root_cause", "capa", "capa_deadline", "department_id"];
    const sets: string[] = [];
    const values: Record<string, any> = { id: params.id };
    for (const f of allowed) {
      if (f in body) { sets.push(`${f} = :${f}`); values[f] = body[f]; }
    }
    if (sets.length === 0) return NextResponse.json({ error: "Không có trường nào để cập nhật" }, { status: 400 });
    sets.push("updated_at = NOW()");
    await run(`UPDATE incident_reports SET ${sets.join(", ")} WHERE id = :id`, values);

    const updated = await get(`SELECT * FROM incident_reports WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
