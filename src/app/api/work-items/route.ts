import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

// GET /api/work-items?type=&status=&priority=&owner_id=&department_id=&position_id=&customer_id=&is_overdue=&from_date=&to_date=&q=&person_q=
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;

    const where: string[] = [];
    const params: Record<string, any> = {};

    const type = sp.get("type");
    if (type) { where.push("wi.type = :type"); params.type = type; }

    const status = sp.get("status");
    if (status) { where.push("wi.status = :status"); params.status = status; }

    const priority = sp.get("priority");
    if (priority) { where.push("wi.priority = :priority"); params.priority = priority; }

    const ownerId = sp.get("owner_id");
    if (ownerId) { where.push("wi.owner_id = :owner_id"); params.owner_id = ownerId; }

    // "Việc của tôi": việc gán trực tiếp (owner_id) HOẶC gán theo đúng Vị trí chịu trách nhiệm của tôi
    // (mục 3 Thay_đổi.docx) HOẶC việc tôi là Người phối hợp (mới, mục 3+4)
    const mine = sp.get("mine");
    if (mine === "true") {
      where.push(
        `(wi.owner_id = :me_id
          OR (:me_position_id::text IS NOT NULL AND wi.position_id = :me_position_id)
          OR EXISTS (SELECT 1 FROM work_item_coordinators wic WHERE wic.work_item_id = wi.id AND wic.user_id = :me_id))`
      );
      params.me_id = user.id;
      params.me_position_id = user.positionId ?? null;
    }

    const departmentId = sp.get("department_id");
    if (departmentId) { where.push("wi.department_id = :department_id"); params.department_id = departmentId; }

    const positionId = sp.get("position_id");
    if (positionId) { where.push("wi.position_id = :position_id"); params.position_id = positionId; }

    const customerId = sp.get("customer_id");
    if (customerId) { where.push("wi.customer_id = :customer_id"); params.customer_id = customerId; }

    const isOverdue = sp.get("is_overdue");
    if (isOverdue !== null) { where.push("wi.is_overdue = :is_overdue"); params.is_overdue = isOverdue === "true"; }

    const fromDate = sp.get("from_date");
    if (fromDate) { where.push("wi.created_at >= :from_date"); params.from_date = fromDate; }

    const toDate = sp.get("to_date");
    if (toDate) { where.push("wi.created_at <= :to_date"); params.to_date = toDate; }

    const q = sp.get("q");
    if (q) { where.push("wi.title ILIKE :q"); params.q = `%${q}%`; }

    // Lọc theo tên người (chịu trách nhiệm hoặc người tạo)
    const personQ = sp.get("person_q");
    if (personQ) {
      where.push("(owner.full_name ILIKE :person_q OR creator.full_name ILIKE :person_q)");
      params.person_q = `%${personQ}%`;
    }

    // Khách hàng chỉ thấy việc do mình tạo hoặc customer_request liên quan
    if (user.roleName === "Khách hàng") {
      where.push("wi.creator_id = :viewer_id");
      params.viewer_id = user.id;
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await all(
      `SELECT wi.*,
              creator.full_name as creator_name,
              owner.full_name as owner_name,
              assigner.full_name as assigned_by_name,
              reporter_pos.name as report_to_name,
              d.name as department_name,
              p.name as position_name,
              c.name as customer_name
       FROM work_items wi
       LEFT JOIN users creator ON creator.id = wi.creator_id
       LEFT JOIN users owner ON owner.id = wi.owner_id
       LEFT JOIN users assigner ON assigner.id = wi.assigned_by_id
       LEFT JOIN positions reporter_pos ON reporter_pos.id = wi.report_to_id
       LEFT JOIN departments d ON d.id = wi.department_id
       LEFT JOIN positions p ON p.id = wi.position_id
       LEFT JOIN customers c ON c.id = wi.customer_id
       ${whereSql}
       ORDER BY
         CASE wi.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         wi.deadline ASC`,
      params
    );

    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// POST /api/work-items
// body: { type, title, deadline, priority (bắt buộc), description?, department_id?, position_id?,
//         customer_id?, meeting_ref?, report_to_id?, owner_id?, coordinator_ids?, save_as_draft? }
//
// Theo mục 4 Thay_đổi.docx: "Người chịu trách nhiệm chính" (owner_id) giờ BẮT BUỘC chọn 1 tài khoản có sẵn
// khi bấm "Tạo và giao việc" (save_as_draft = false/không gửi) - việc được tạo và giao ngay, trạng thái
// "Chờ tiếp nhận". Nếu bấm "Lưu nháp" (save_as_draft = true), có thể chưa chọn owner_id, trạng thái "Nháp".
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const {
      type, title, description, priority, deadline,
      department_id, position_id, customer_id, meeting_ref, report_to_id,
      owner_id, coordinator_ids, save_as_draft,
    } = body;

    if (!type || !title || !deadline || !priority) {
      return NextResponse.json(
        { error: "Thiếu trường bắt buộc: type, title, deadline, priority" },
        { status: 400 }
      );
    }
    const validTypes = ["issue", "task", "customer_request", "meeting_action", "management_task"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "type không hợp lệ" }, { status: 400 });
    }
    if (!save_as_draft && !owner_id) {
      return NextResponse.json(
        { error: "Cần chọn Người chịu trách nhiệm chính để tạo và giao việc (hoặc chọn Lưu nháp nếu chưa có người)" },
        { status: 400 }
      );
    }

    const id = uuid();
    const status = save_as_draft ? "draft" : "pending_acceptance";

    await run(
      `INSERT INTO work_items
       (id, type, title, description, priority, status, creator_id, owner_id, assigned_by_id, assigned_at, report_to_id,
        department_id, position_id, customer_id, meeting_ref, deadline)
       VALUES (:id, :type, :title, :description, :priority, :status, :creator_id, :owner_id, :assigned_by_id, :assigned_at, :report_to_id,
        :department_id, :position_id, :customer_id, :meeting_ref, :deadline)`,
      {
        id,
        type,
        title,
        description: description ?? null,
        priority,
        status,
        creator_id: user.id,
        owner_id: owner_id ?? null,
        assigned_by_id: owner_id ? user.id : null,
        assigned_at: owner_id ? new Date().toISOString() : null,
        report_to_id: report_to_id ?? null,
        department_id: department_id ?? null,
        position_id: position_id ?? null,
        customer_id: customer_id ?? null,
        meeting_ref: meeting_ref ?? null,
        deadline,
      }
    );

    if (Array.isArray(coordinator_ids)) {
      for (const uid of coordinator_ids) {
        if (uid && uid !== owner_id) {
          await run(
            `INSERT INTO work_item_coordinators (work_item_id, user_id) VALUES (:wi, :uid) ON CONFLICT DO NOTHING`,
            { wi: id, uid }
          );
        }
      }
    }

    await run(
      `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
       VALUES (:id, :work_item_id, NULL, :to_status, :changed_by, 'Tạo mới')`,
      { id: uuid(), work_item_id: id, to_status: status, changed_by: user.id }
    );

    if (owner_id) {
      await notify(owner_id, "assigned", `Bạn được giao việc: "${title}"`, id);
    } else {
      // Lưu nháp, chưa có người chịu trách nhiệm => báo Quản lý/BGĐ cùng phòng ban vào giao sau
      const leaders = await all<any>(
        `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name IN ('Quản lý','BGĐ')
         AND (u.department_id = :dept OR :dept2::text IS NULL)`,
        { dept: department_id ?? null, dept2: department_id ?? null }
      );
      for (const l of leaders) await notify(l.id, "created", `Có bản nháp mới cần giao người xử lý: "${title}"`, id);
    }

    if (Array.isArray(coordinator_ids)) {
      for (const uid of coordinator_ids) {
        if (uid && uid !== owner_id) await notify(uid, "assigned", `Bạn được thêm làm người phối hợp cho việc: "${title}"`, id);
      }
    }

    if (report_to_id) {
      // report_to_id là position_id (chức danh, giữ nguyên quyết định đợt 4) - tự tìm user đang giữ chức danh đó
      const reportToPosition = await get<any>(`SELECT name FROM positions WHERE id = :id`, { id: report_to_id });
      if (reportToPosition && reportToPosition.name !== "Khách hàng") {
        const holders = await all<any>(
          `SELECT id FROM users WHERE position_id = :position_id AND is_active = true`,
          { position_id: report_to_id }
        );
        for (const h of holders) {
          await notify(h.id, "created", `Việc mới cần báo cáo cho ${reportToPosition.name}: "${title}"`, id);
        }
      }
    }

    const created = await get(`SELECT * FROM work_items WHERE id = :id`, { id });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
