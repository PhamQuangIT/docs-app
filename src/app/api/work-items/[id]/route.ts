import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser, canAssign } from "@/lib/auth";
import { isAssigner, STATUSES } from "@/lib/workflow";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireUser();
    const item = await get<any>(
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
       WHERE wi.id = :id`,
      { id: params.id }
    );
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    const coordinators = await all(
      `SELECT u.id, u.full_name FROM work_item_coordinators wic
       JOIN users u ON u.id = wic.user_id
       WHERE wic.work_item_id = :id`,
      { id: params.id }
    );
    const comments = await all(
      `SELECT wc.*, u.full_name as user_name FROM work_item_comments wc
       JOIN users u ON u.id = wc.user_id
       WHERE wc.work_item_id = :id ORDER BY wc.created_at ASC`,
      { id: params.id }
    );
    const attachments = await all(
      `SELECT * FROM work_item_attachments WHERE work_item_id = :id ORDER BY created_at ASC`,
      { id: params.id }
    );
    const history = await all(
      `SELECT h.*, u.full_name as changed_by_name FROM work_item_history h
       JOIN users u ON u.id = h.changed_by
       WHERE h.work_item_id = :id ORDER BY h.created_at ASC`,
      { id: params.id }
    );
    const escalations = await all(
      `SELECT e.*, tu.full_name as escalated_to_name, fu.full_name as escalated_from_name
       FROM escalations e
       JOIN users tu ON tu.id = e.escalated_to
       LEFT JOIN users fu ON fu.id = e.escalated_from
       WHERE e.work_item_id = :id ORDER BY e.created_at ASC`,
      { id: params.id }
    );
    const proposals = await all(
      `SELECT p.*, u.full_name as proposed_by_name, r.full_name as reviewed_by_name, po.full_name as proposed_owner_name
       FROM work_item_proposals p
       JOIN users u ON u.id = p.proposed_by
       LEFT JOIN users r ON r.id = p.reviewed_by
       LEFT JOIN users po ON po.id = p.proposed_owner_id
       WHERE p.work_item_id = :id ORDER BY p.created_at DESC`,
      { id: params.id }
    );

    return NextResponse.json({ ...item, coordinators, comments, attachments, history, escalations, proposals });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// PATCH: "Sửa việc" trực tiếp (mục 8 Thay_đổi.docx) - CHỈ Người giao việc (hoặc Quản lý/BGĐ), không qua đề xuất
// vì họ đã là người có quyền quyết định. Nếu việc đã có người chịu trách nhiệm, bắt buộc nêu lý do.
// body: { title?, description?, priority?, deadline?, department_id?, position_id?, customer_id?,
//         meeting_ref?, report_to_id?, coordinator_ids?, reason? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    if ([STATUSES.COMPLETED, STATUSES.CANCELLED].includes(item.status)) {
      return NextResponse.json({ error: "Việc đã kết thúc, không thể sửa" }, { status: 400 });
    }
    if ([STATUSES.PENDING_CHANGE_APPROVAL, STATUSES.PENDING_COMPLETION_APPROVAL].includes(item.status)) {
      return NextResponse.json({ error: "Việc đang có đề xuất chờ duyệt, cần xử lý xong trước khi sửa" }, { status: 400 });
    }
    if (!(isAssigner(item, user.id) || canAssign(user.roleName))) {
      return NextResponse.json({ error: "Chỉ người giao việc mới được sửa việc này" }, { status: 403 });
    }

    const { reason, coordinator_ids } = body;
    if (item.owner_id && !reason) {
      return NextResponse.json({ error: "Việc đã có người chịu trách nhiệm, cần nêu lý do khi sửa" }, { status: 400 });
    }

    const allowedFields = ["title", "description", "priority", "deadline", "department_id", "position_id", "customer_id", "meeting_ref", "report_to_id"];
    const sets: string[] = [];
    const values: Record<string, any> = { id: params.id };
    const beforeAfter: string[] = [];
    for (const f of allowedFields) {
      if (f in body && body[f] !== item[f]) {
        sets.push(`${f} = :${f}`);
        values[f] = body[f];
        beforeAfter.push(`${f}: "${item[f] ?? ""}" -> "${body[f] ?? ""}"`);
      }
    }

    if (Array.isArray(coordinator_ids)) {
      await run(`DELETE FROM work_item_coordinators WHERE work_item_id = :id`, { id: params.id });
      for (const uid of coordinator_ids) {
        if (uid && uid !== (body.owner_id ?? item.owner_id)) {
          await run(
            `INSERT INTO work_item_coordinators (work_item_id, user_id) VALUES (:wi, :uid) ON CONFLICT DO NOTHING`,
            { wi: params.id, uid }
          );
        }
      }
      beforeAfter.push(`người phối hợp: [${coordinator_ids.join(", ")}]`);
    }

    if (sets.length === 0 && !Array.isArray(coordinator_ids)) {
      return NextResponse.json({ error: "Không có trường nào để cập nhật" }, { status: 400 });
    }

    if (sets.length > 0) {
      sets.push("updated_at = NOW()");
      await run(`UPDATE work_items SET ${sets.join(", ")} WHERE id = :id`, values);
    }

    if (beforeAfter.length > 0) {
      await run(
        `INSERT INTO work_item_history (id, work_item_id, from_status, to_status, changed_by, note)
         VALUES (:id, :wi, :status, :status, :changed_by, :note)`,
        {
          id: uuid(),
          wi: params.id,
          status: item.status,
          changed_by: user.id,
          note: `Sửa việc${reason ? " (lý do: " + reason + ")" : ""}: ${beforeAfter.join("; ")}`,
        }
      );
    }

    const updated = await get(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
