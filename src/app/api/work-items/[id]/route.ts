import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";

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

    return NextResponse.json({ ...item, comments, attachments, history, escalations });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// PATCH: cập nhật các field cơ bản (title, description, priority, deadline...)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireUser();
    const body = await req.json();
    const allowedFields = ["title", "description", "priority", "deadline", "department_id", "position_id", "customer_id", "meeting_ref", "report_to_id"];
    const sets: string[] = [];
    const values: Record<string, any> = { id: params.id };
    for (const f of allowedFields) {
      if (f in body) {
        sets.push(`${f} = :${f}`);
        values[f] = body[f];
      }
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: "Không có trường nào để cập nhật" }, { status: 400 });
    }
    sets.push("updated_at = NOW()");
    await run(`UPDATE work_items SET ${sets.join(", ")} WHERE id = :id`, values);
    const updated = await get(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
