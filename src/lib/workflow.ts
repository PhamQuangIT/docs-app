// Quy tắc chuyển trạng thái hợp lệ - đúng theo Workflow mục 16 trong SDD
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new: ["assigned", "cancelled"],
  assigned: ["doing", "cancelled"],
  doing: ["waiting", "completed", "cancelled"],
  waiting: ["doing", "cancelled"],
  completed: ["closed", "doing"], // doing = reject lại nếu chưa đạt
  closed: ["doing"], // reopen trong 48h (kiểm tra thời gian ở API)
  cancelled: [],
};

export function isTransitionAllowed(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

// Xác định ai được quyền duyệt đề xuất (propose) của 1 work item:
// Ưu tiên người giao việc (assigned_by_id); nếu việc chưa có người giao việc chính
// thức, dự phòng cho người tạo hoặc Quản lý/BGĐ duyệt (tránh đề xuất bị "treo").
export function canReviewProposal(
  item: { assigned_by_id: string | null; creator_id: string },
  reviewerUserId: string,
  reviewerRoleName: string
): boolean {
  if (item.assigned_by_id) return item.assigned_by_id === reviewerUserId;
  return item.creator_id === reviewerUserId || ["BGĐ", "Quản lý"].includes(reviewerRoleName);
}

export function slaMinutesFor(priority: string) {
  const table: Record<string, { response: number; resolution: number }> = {
    urgent: { response: 15, resolution: 240 },
    high: { response: 60, resolution: 1440 },
    normal: { response: 240, resolution: 4320 },
    low: { response: 1440, resolution: 10080 },
  };
  return table[priority] ?? table.normal;
}
