import { NextRequest, NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requireUser, canViewReports } from "@/lib/auth";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canViewReports(user.roleName)) {
      return NextResponse.json({ error: "Bạn không có quyền xuất báo cáo" }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");

    const where: string[] = [];
    const params: Record<string, any> = {};
    if (from) { where.push("wi.created_at >= :from"); params.from = from; }
    if (to) { where.push("wi.created_at <= :to"); params.to = to; }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await all<any>(
      `SELECT wi.type, wi.title, wi.priority, wi.status, wi.is_overdue,
              creator.full_name as creator_name, owner.full_name as owner_name,
              d.name as department_name, c.name as customer_name,
              wi.deadline, wi.created_at, wi.completed_at, wi.closed_at
       FROM work_items wi
       LEFT JOIN users creator ON creator.id = wi.creator_id
       LEFT JOIN users owner ON owner.id = wi.owner_id
       LEFT JOIN departments d ON d.id = wi.department_id
       LEFT JOIN customers c ON c.id = wi.customer_id
       ${whereSql}
       ORDER BY wi.created_at DESC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Báo cáo");
    sheet.columns = [
      { header: "Loại", key: "type", width: 18 },
      { header: "Tiêu đề", key: "title", width: 40 },
      { header: "Ưu tiên", key: "priority", width: 12 },
      { header: "Trạng thái", key: "status", width: 14 },
      { header: "Quá hạn", key: "is_overdue", width: 10 },
      { header: "Người tạo", key: "creator_name", width: 20 },
      { header: "Người xử lý", key: "owner_name", width: 20 },
      { header: "Phòng ban", key: "department_name", width: 22 },
      { header: "Khách hàng", key: "customer_name", width: 22 },
      { header: "Deadline", key: "deadline", width: 20 },
      { header: "Ngày tạo", key: "created_at", width: 20 },
      { header: "Hoàn thành", key: "completed_at", width: 20 },
      { header: "Đóng lúc", key: "closed_at", width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      sheet.addRow({ ...r, is_overdue: r.is_overdue ? "Có" : "Không" });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bao-cao-van-hanh.xlsx"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
