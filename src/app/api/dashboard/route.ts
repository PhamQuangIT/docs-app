import { NextResponse } from "next/server";
import { all, get } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();

    const todayIssues = await get<any>(
      `SELECT COUNT(*) as cnt FROM work_items WHERE type = 'issue' AND created_at::date = CURRENT_DATE`
    );
    const overdue = await all(
      `SELECT wi.*, owner.full_name as owner_name FROM work_items wi
       LEFT JOIN users owner ON owner.id = wi.owner_id
       WHERE wi.is_overdue = true AND wi.status NOT IN ('completed','closed','cancelled')
       ORDER BY wi.deadline ASC LIMIT 20`
    );
    const needSupport = await all(
      `SELECT wi.*, owner.full_name as owner_name FROM work_items wi
       LEFT JOIN users owner ON owner.id = wi.owner_id
       WHERE wi.status = 'waiting' ORDER BY wi.updated_at DESC LIMIT 20`
    );
    const completedToday = await get<any>(
      `SELECT COUNT(*) as cnt FROM work_items WHERE completed_at::date = CURRENT_DATE`
    );
    const myTask = await all(
      `SELECT * FROM work_items
       WHERE (owner_id = :owner_id OR (:my_position_id::text IS NOT NULL AND position_id = :my_position_id))
       AND status NOT IN ('closed','cancelled')
       ORDER BY deadline ASC LIMIT 20`,
      { owner_id: user.id, my_position_id: user.positionId ?? null }
    );
    const deadlineToday = await all(
      `SELECT wi.*, owner.full_name as owner_name FROM work_items wi
       LEFT JOIN users owner ON owner.id = wi.owner_id
       WHERE wi.deadline::date = CURRENT_DATE AND wi.status NOT IN ('completed','closed','cancelled')
       ORDER BY wi.deadline ASC LIMIT 20`
    );
    const deptPerformance = await all(
      `SELECT d.name as department_name,
              COUNT(*)::int as total,
              SUM(CASE WHEN wi.status = 'closed' AND wi.is_overdue = false THEN 1 ELSE 0 END)::int as on_time,
              SUM(CASE WHEN wi.status = 'closed' THEN 1 ELSE 0 END)::int as closed_count
       FROM work_items wi
       LEFT JOIN departments d ON d.id = wi.department_id
       GROUP BY d.name`
    );
    const customerRequests = await all(
      `SELECT wi.*, c.name as customer_name FROM work_items wi
       LEFT JOIN customers c ON c.id = wi.customer_id
       WHERE wi.type = 'customer_request' AND wi.status NOT IN ('closed','cancelled')
       ORDER BY CASE wi.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, wi.deadline ASC
       LIMIT 20`
    );

    return NextResponse.json({
      todayIssues: Number(todayIssues?.cnt ?? 0),
      completedToday: Number(completedToday?.cnt ?? 0),
      overdue,
      needSupport,
      myTask,
      deadlineToday,
      deptPerformance,
      customerRequests,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
