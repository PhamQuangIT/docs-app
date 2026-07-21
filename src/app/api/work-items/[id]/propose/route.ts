import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { v4 as uuid } from "uuid";

// POST /api/work-items/:id/propose
// body: { type: 'complete'|'cancel'|'edit', note?, proposed_title?, proposed_description?, proposed_deadline? }
// Chỉ người ĐANG được giao việc (owner_id) mới được đề xuất sửa đổi công việc đó.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { type, note, proposed_title, proposed_description, proposed_deadline } = body;

    if (!["complete", "cancel", "edit"].includes(type)) {
      return NextResponse.json({ error: "Loại đề xuất không hợp lệ" }, { status: 400 });
    }

    const item = await get<any>(`SELECT * FROM work_items WHERE id = :id`, { id: params.id });
    if (!item) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    if (!item.owner_id || item.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Chỉ người được giao việc mới được đề xuất sửa đổi công việc này" },
        { status: 403 }
      );
    }

    if (["completed", "closed", "cancelled"].includes(item.status)) {
      return NextResponse.json({ error: "Việc đã kết thúc, không thể đề xuất thêm" }, { status: 400 });
    }

    if (type === "edit" && !proposed_title && !proposed_description && !proposed_deadline) {
      return NextResponse.json({ error: "Cần nhập ít nhất 1 nội dung muốn sửa" }, { status: 400 });
    }

    const id = uuid();
    await run(
      `INSERT INTO work_item_proposals
       (id, work_item_id, type, proposed_by, note, proposed_title, proposed_description, proposed_deadline)
       VALUES (:id, :work_item_id, :type, :proposed_by, :note, :proposed_title, :proposed_description, :proposed_deadline)`,
      {
        id,
        work_item_id: params.id,
        type,
        proposed_by: user.id,
        note: note ?? null,
        proposed_title: proposed_title ?? null,
        proposed_description: proposed_description ?? null,
        proposed_deadline: proposed_deadline ?? null,
      }
    );

    const typeLabel = type === "complete" ? "hoàn thành" : type === "cancel" ? "hủy" : "sửa nội dung/hạn";
    const reviewerId = item.assigned_by_id || item.creator_id;
    if (reviewerId) {
      await notify(reviewerId, "status_change", `${user.fullName} đề nghị ${typeLabel} việc "${item.title}"`, params.id);
    }

    return NextResponse.json({ id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
