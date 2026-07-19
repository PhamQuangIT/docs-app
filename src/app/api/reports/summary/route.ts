import { NextRequest, NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requireUser, canViewReports } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GROUP_COLUMNS: Record<string, string> = {
  employee: "owner.full_name",
  leader: "owner.full_name", // MVP: leader cũng là owner của việc do leader phụ trách
  customer: "c.name",
  department: "d.name",
  status: "wi.status",
  priority: "wi.priority",
};

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canViewReports(user.roleName)) {
      return NextResponse.json({ error: "Bạn không có quyền xem báo cáo" }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const groupBy = sp.get("group_by") || "status";
    const from = sp.get("from");
    const to = sp.get("to");

    const groupCol = GROUP_COLUMNS[groupBy];
    if (!groupCol) {
      return NextResponse.json({ error: "group_by không hợp lệ" }, { status: 400 });
    }

    const where: string[] = [];
    const params: Record<string, any> = {};
    if (from) { where.push("wi.created_at >= :from"); params.from = from; }
    if (to) { where.push("wi.created_at <= :to"); params.to = to; }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await all(
      `SELECT ${groupCol} as group_label,
              COUNT(*)::int as total,
              SUM(CASE WHEN wi.status = 'closed' THEN 1 ELSE 0 END)::int as closed_count,
              SUM(CASE WHEN wi.status = 'closed' AND wi.is_overdue = false THEN 1 ELSE 0 END)::int as on_time_count,
              SUM(CASE WHEN wi.is_overdue = true THEN 1 ELSE 0 END)::int as overdue_count
       FROM work_items wi
       LEFT JOIN users owner ON owner.id = wi.owner_id
       LEFT JOIN departments d ON d.id = wi.department_id
       LEFT JOIN customers c ON c.id = wi.customer_id
       ${whereSql}
       GROUP BY ${groupCol}
       ORDER BY total DESC`,
      params
    );

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
