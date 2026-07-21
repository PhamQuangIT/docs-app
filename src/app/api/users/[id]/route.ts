import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser, canManageUsers } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH /api/users/:id - sửa thông tin user (Admin), hoặc vô hiệu hoá tài khoản
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canManageUsers(user.roleName)) {
      return NextResponse.json({ error: "Chỉ BGĐ được sửa user" }, { status: 403 });
    }
    const body = await req.json();
    const allowed = ["full_name", "phone", "role_id", "department_id", "position_id", "is_active"];
    const sets: string[] = [];
    const values: Record<string, any> = { id: params.id };
    for (const f of allowed) {
      if (f in body) {
        sets.push(`${f} = :${f}`);
        values[f] = body[f];
      }
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: "Không có trường nào để cập nhật" }, { status: 400 });
    }
    sets.push("updated_at = NOW()");
    await run(`UPDATE users SET ${sets.join(", ")} WHERE id = :id`, values);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

// DELETE /api/users/:id - xoá user (Admin), không cho tự xoá chính mình
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canManageUsers(user.roleName)) {
      return NextResponse.json({ error: "Chỉ BGĐ được xoá user" }, { status: 403 });
    }
    if (params.id === user.id) {
      return NextResponse.json({ error: "Không thể tự xoá tài khoản của chính mình" }, { status: 400 });
    }
    const target = await get<any>(`SELECT id FROM users WHERE id = :id`, { id: params.id });
    if (!target) return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });

    // Không xoá cứng vì user có thể đã là creator/owner của nhiều work_items (ràng buộc khoá ngoại).
    // Thay vào đó vô hiệu hoá tài khoản (is_active = false) - vẫn giữ lịch sử xử lý nguyên vẹn.
    await run(`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = :id`, { id: params.id });
    return NextResponse.json({ ok: true, note: "Đã vô hiệu hoá tài khoản (giữ lại lịch sử công việc liên quan)" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
