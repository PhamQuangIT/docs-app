import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { get } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const COOKIE_NAME = "docs_session";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  departmentId: string | null;
  positionId: string | null;
}

export function signSession(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "1d" });
}

export function setSessionCookie(token: string) {
  // KHÔNG đặt maxAge -> cookie theo phiên trình duyệt (session cookie).
  // Đóng hẳn trình duyệt/app (không chỉ đóng tab) sẽ yêu cầu đăng nhập lại (mục 5 - Thay_đổi.docx).
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const row = await get<any>(
      `SELECT u.id, u.email, u.full_name as "fullName", u.role_id as "roleId",
              r.name as "roleName", u.department_id as "departmentId", u.position_id as "positionId"
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = :id AND u.is_active = true`,
      { id: payload.sub }
    );
    return row ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  return user;
}

// ============================================================
// Hệ vai trò mới (theo Thay_đổi.docx mục 4 + 8):
//   BGĐ               - toàn quyền (tương đương Admin + Operation Manager cũ)
//   Quản lý           - gán/đóng việc, xem báo cáo nhóm (tương đương Leader + Supervisor cũ)
//   Sản xuất trực tiếp - nhân viên thường, thuộc khối sản xuất
//   Gián tiếp         - nhân viên thường, thuộc khối gián tiếp
//   Khách hàng        - tài khoản khách hàng bên ngoài, chỉ xem/tạo yêu cầu của chính mình
//                       (giữ thêm ngoài 4 nhóm gốc vì phục vụ mục đích khác - xem đại diện KH)
// ============================================================

export function canAssign(roleName: string) {
  return ["BGĐ", "Quản lý"].includes(roleName);
}
export function canCloseConfirm(roleName: string) {
  return ["BGĐ", "Quản lý"].includes(roleName);
}
export function canManageUsers(roleName: string) {
  return roleName === "BGĐ";
}
export function canViewReports(roleName: string) {
  return ["BGĐ", "Quản lý"].includes(roleName);
}
export function isCustomerViewer(roleName: string) {
  return roleName === "Khách hàng";
}
