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
}

export function signSession(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
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
              r.name as "roleName", u.department_id as "departmentId"
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

// Quyền theo vai trò (map gọn theo mục 19 SRS - Permission Matrix)
export function canAssign(roleName: string) {
  return ["Admin", "Operation Manager", "Leader", "Supervisor"].includes(roleName);
}
export function canCloseConfirm(roleName: string) {
  return ["Admin", "Operation Manager", "Leader"].includes(roleName);
}
export function canManageUsers(roleName: string) {
  return roleName === "Admin";
}
export function canViewReports(roleName: string) {
  return ["Admin", "Operation Manager", "Leader"].includes(roleName);
}
