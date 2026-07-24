import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { canActOnIncidentLevel } from "@/lib/incident-workflow";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

const SEVERITY_TO_PRIORITY: Record<string, string> = {
  light: "low",
  medium: "normal",
  serious: "high",
  critical: "urgent",
};

// POST /api/incident-reports/:id/generate-task  body: { deadline?, owner_id? }
// "Tạo công việc khắc phục" (mục 1 Master Prompt) - cấp Giám đốc/Trợ lý GĐ (hoặc Super Admin) bấm khi duyệt,
// được CHỈNH LẠI deadline trước khi phát hành. Chỉ tạo 1 lần (generated_task_id).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));

    const item = await get<any>(`SELECT * FROM incident_reports WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    if (!["pending_director", "approved"].includes(item.status)) {
      return NextResponse.json({ error: "Chỉ tạo công việc khắc phục khi báo cáo đã tới cấp Giám đốc/đã duyệt" }, { status: 400 });
    }
    if (item.generated_task_id) {
      return NextResponse.json({ error: "Báo cáo này đã có công việc khắc phục rồi" }, { status: 400 });
    }

    const allowed =
      isSuperAdmin(user.email) ||
      (await canActOnIncidentLevel("pending_director", item.department_id, user.id, user.roleName, user.positionId ?? null));
    if (!allowed) {
      return NextResponse.json({ error: "Chỉ Giám đốc/Trợ lý Giám đốc (hoặc Super Admin) mới được tạo công việc khắc phục" }, { status: 403 });
    }

    const deadline = body.deadline || item.capa_deadline;
    if (!deadline) {
      return NextResponse.json({ error: "Cần chọn Deadline thực hiện đối sách" }, { status: 400 });
    }

    const taskId = uuid();
    const ownerId = body.owner_id || null;
    const status = ownerId ? "pending_acceptance" : "draft";
    await run(
      `INSERT INTO work_items
       (id, type, title, description, priority, status, creator_id, owner_id, assigned_by_id, assigned_at,
        department_id, deadline)
       VALUES (:id, 'task', :title, :description, :priority, :status, :creator_id, :owner_id, :assigned_by_id, :assigned_at,
        :department_id, :deadline)`,
      {
        id: taskId,
        title: `Khắc phục sự cố: ${item.title}`,
        description: [item.description, item.root_cause ? `Nguyên nhân: ${item.root_cause}` : "", item.capa ? `Đối sách: ${item.capa}` : ""]
          .filter(Boolean)
          .join("\n\n"),
        priority: SEVERITY_TO_PRIORITY[item.severity] ?? "normal",
        status,
        creator_id: user.id,
        owner_id: ownerId,
        assigned_by_id: ownerId ? user.id : null,
        assigned_at: ownerId ? new Date().toISOString() : null,
        department_id: item.department_id,
        deadline,
      }
    );
    await run(
      `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
       VALUES (:id, :wi, NULL, :status, :changed_by, :note)`,
      { id: uuid(), wi: taskId, status, changed_by: user.id, note: `Tự động sinh từ Báo cáo sự cố #${params.id}` }
    );

    await run(
      `UPDATE incident_reports SET generated_task_id = :task_id, status = 'approved', updated_at = NOW() WHERE id = :id`,
      { task_id: taskId, id: params.id }
    );
    await run(
      `INSERT INTO incident_report_history (id, incident_report_id, from_status, to_status, changed_by, note)
       VALUES (:id, :ir, :from_status, 'approved', :changed_by, :note)`,
      { id: uuid(), ir: params.id, from_status: item.status, changed_by: user.id, note: `Đã tạo công việc khắc phục #${taskId}` }
    );

    await notify(item.creator_id, "status_change", `Báo cáo sự cố "${item.title}" đã được duyệt và tạo công việc khắc phục`, taskId);
    if (ownerId) await notify(ownerId, "assigned", `Bạn được giao công việc khắc phục sự cố: "${item.title}"`, taskId);

    const updated = await get(`SELECT * FROM incident_reports WHERE id = :id`, { id: params.id });
    return NextResponse.json({ ...updated, generated_task_id: taskId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
