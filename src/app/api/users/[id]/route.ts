import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser, canManageUsers } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 6; // đồng bộ quy tắc với /api/auth/change-password

// PATCH /api/users/:id - sửa thông tin user (Admin), vô hiệu hoá tài khoản, hoặc reset mật khẩu (mục 12)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canManageUsers(user.roleName)) {
      return NextResponse.json({ error: "Chỉ BGĐ được sửa user" }, { status: 403 });
    }
    const body = await req.json();

    // --- Reset mật khẩu (chỉ xử lý khi cả 2 trường đều được nhập; để trống = không đổi mật khẩu) ---
    const { new_password, confirm_password } = body;
    const wantsPasswordReset = new_password != null && new_password !== "";
    if (wantsPasswordReset) {
      if (confirm_password == null || confirm_password === "") {
        return NextResponse.json({ error: "Thiếu xác nhận mật khẩu" }, { status: 400 });
      }
      if (new_password !== confirm_password) {
        return NextResponse.json({ error: "Mật khẩu mới và xác nhận mật khẩu không khớp" }, { status: 400 });
      }
      if (new_password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự` },
          { status: 400 }
        );
      }
      const target = await get<any>(`SELECT id FROM users WHERE id = :id`, { id: params.id });
      if (!target) return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });

      const newHash = bcrypt.hashSync(new_password, 10);
      await run(`UPDATE users SET password_hash = :hash, updated_at = NOW() WHERE id = :id`, {
        hash: newHash,
        id: params.id,
      });
      await run(
        `INSERT INTO admin_audit_log (id, action, actor_id, target_user_id, detail)
         VALUES (:id, 'reset_password', :actor_id, :target_id, :detail)`,
        {
          id: randomUUID(),
          actor_id: user.id,
          target_id: params.id,
          detail: `Admin ${user.fullName} (${user.email}) đã reset mật khẩu cho tài khoản này`,
        }
      );
    }

    // --- Các trường thông tin khác ---
    const allowed = ["full_name", "phone", "role_id", "department_id", "position_id", "is_active"];
    const sets: string[] = [];
    const values: Record<string, any> = { id: params.id };
    for (const f of allowed) {
      if (f in body) {
        sets.push(`${f} = :${f}`);
        values[f] = body[f];
      }
    }
    if (sets.length > 0) {
      sets.push("updated_at = NOW()");
      await run(`UPDATE users SET ${sets.join(", ")} WHERE id = :id`, values);
    } else if (!wantsPasswordReset) {
      return NextResponse.json({ error: "Không có trường nào để cập nhật" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, password_reset: wantsPasswordReset });
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
