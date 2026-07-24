import { all } from "./db";

// Luồng duyệt Báo cáo sự cố (mục 1 Master Prompt 23/07/2026):
//   Trưởng nhóm -> Phó phòng phụ trách -> Trưởng phòng -> Giám đốc / Trợ lý Giám đốc
//
// Giả định (chức danh là danh mục do Admin tự cấu hình, không cố định id): khớp theo TÊN chức danh
// (không phân biệt hoa/thường, chấp nhận biến thể) trong đúng Bộ phận của báo cáo. Cấp cuối (Giám đốc/
// Trợ lý GĐ) khớp theo vai trò toàn cục BGĐ HOẶC chức danh có chữ "trợ lý" + "giám đốc".
export const INCIDENT_LEVELS = [
  { status: "pending_team_lead", label: "Trưởng nhóm", positionKeywords: ["trưởng nhóm"] },
  { status: "pending_deputy", label: "Phó phòng phụ trách", positionKeywords: ["phó phòng"] },
  { status: "pending_department_head", label: "Trưởng phòng", positionKeywords: ["trưởng phòng"] },
  { status: "pending_director", label: "Giám đốc / Trợ lý Giám đốc", positionKeywords: ["trợ lý giám đốc", "trợ lý gđ"], roleNames: ["BGĐ"] },
] as const;

export type IncidentStatus = (typeof INCIDENT_LEVELS)[number]["status"] | "approved" | "rejected" | "cancelled";

export function nextIncidentStatus(current: string): IncidentStatus {
  const idx = INCIDENT_LEVELS.findIndex((l) => l.status === current);
  if (idx === -1 || idx === INCIDENT_LEVELS.length - 1) return "approved";
  return INCIDENT_LEVELS[idx + 1].status;
}

export function levelLabel(status: string): string {
  return INCIDENT_LEVELS.find((l) => l.status === status)?.label ?? status;
}

// Kiểm tra user hiện tại có đúng chức danh/vai trò để duyệt cấp hiện tại của báo cáo hay không
export async function canActOnIncidentLevel(
  status: string,
  departmentId: string | null,
  userId: string,
  userRoleName: string,
  userPositionId: string | null
): Promise<boolean> {
  const level = INCIDENT_LEVELS.find((l) => l.status === status);
  if (!level) return false;

  if ("roleNames" in level && (level.roleNames as readonly string[] | undefined)?.includes(userRoleName)) return true;

  if (!userPositionId) return false;
  const pos = await all<any>(`SELECT name FROM positions WHERE id = :id`, { id: userPositionId });
  const posName = (pos[0]?.name ?? "").toLowerCase();
  const matchesKeyword = level.positionKeywords.some((k) => posName.includes(k));
  if (!matchesKeyword) return false;

  // Nếu báo cáo thuộc 1 bộ phận cụ thể, người duyệt (trừ cấp Giám đốc) nên cùng bộ phận đó.
  // Bỏ qua kiểm tra này nếu báo cáo chưa gắn bộ phận (department_id null).
  return true; // department check được thực hiện ở tầng gọi (route) để giữ hàm này thuần khiết, dễ test
}
