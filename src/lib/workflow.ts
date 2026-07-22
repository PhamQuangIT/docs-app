// Quy tắc chuyển trạng thái + phân quyền theo vai trò TRONG TỪNG VIỆC
// - đúng theo Thay_đổi.docx mục 1-8 (21/07/2026, đợt 5)
//
// 9 trạng thái (mục 6):
//   draft                        - Nháp (chưa giao cho ai)
//   pending_acceptance           - Chờ tiếp nhận (đã giao, chờ người chịu trách nhiệm phản hồi)
//   in_progress                  - Đang thực hiện
//   pending_change_approval      - Chờ duyệt thay đổi (có đề xuất sửa/hủy/gia hạn đang chờ quyết định)
//   pending_completion_approval  - Chờ duyệt hoàn thành (đã nộp kết quả, chờ người giao việc duyệt)
//   rework_requested             - Yêu cầu xử lý lại
//   acceptance_rejected          - Từ chối tiếp nhận (có lý do)
//   completed                    - Hoàn thành (trạng thái cuối)
//   cancelled                    - Đã hủy (trạng thái cuối)

export const STATUSES = {
  DRAFT: "draft",
  PENDING_ACCEPTANCE: "pending_acceptance",
  IN_PROGRESS: "in_progress",
  PENDING_CHANGE_APPROVAL: "pending_change_approval",
  PENDING_COMPLETION_APPROVAL: "pending_completion_approval",
  REWORK_REQUESTED: "rework_requested",
  ACCEPTANCE_REJECTED: "acceptance_rejected",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const FINAL_STATUSES = [STATUSES.COMPLETED, STATUSES.CANCELLED];

// Bảng chuyển trạng thái hợp lệ - đúng theo bảng mục 6
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: [STATUSES.PENDING_ACCEPTANCE, STATUSES.CANCELLED],
  // Cho phép Người giao việc hủy trực tiếp (mục 8 "Hủy việc") kể cả khi đang chờ tiếp nhận/xử lý lại/bị từ chối
  // tiếp nhận - bảng mục 6 chỉ liệt kê luồng "bình thường", thao tác ngoại lệ ở mục 8 áp dụng rộng hơn.
  pending_acceptance: [STATUSES.IN_PROGRESS, STATUSES.ACCEPTANCE_REJECTED, STATUSES.CANCELLED],
  in_progress: [
    STATUSES.PENDING_COMPLETION_APPROVAL,
    STATUSES.PENDING_CHANGE_APPROVAL,
    STATUSES.REWORK_REQUESTED,
    STATUSES.CANCELLED,
  ],
  pending_change_approval: [STATUSES.IN_PROGRESS], // hệ thống tự chuyển sau khi duyệt/từ chối đề xuất
  pending_completion_approval: [STATUSES.COMPLETED, STATUSES.REWORK_REQUESTED],
  rework_requested: [STATUSES.IN_PROGRESS, STATUSES.CANCELLED],
  acceptance_rejected: [STATUSES.PENDING_ACCEPTANCE, STATUSES.CANCELLED], // giao lại người khác, hoặc hủy
  completed: [STATUSES.IN_PROGRESS], // mở lại trong 48h, có quyền + lý do (mục 8 "Mở lại việc")
  cancelled: [],
};

export function isTransitionAllowed(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

// ============================================================
// Vai trò TRONG TỪNG VIỆC (mục 2 Thay_đổi.docx) - khác với vai trò toàn cục (BGĐ/Quản lý/...)
//   Người tạo             = work_items.creator_id
//   Người giao việc       = work_items.assigned_by_id (rơi về creator_id nếu chưa từng gán chính thức)
//   Người chịu trách nhiệm chính = work_items.owner_id (bắt buộc, 1 người)
//   Người phối hợp        = work_item_coordinators (nhiều người)
//   Người báo cáo/duyệt   = suy ra theo report_to_id (chức danh) - giữ nguyên quyết định đợt 4,
//                           KHÔNG đổi sang chọn theo người cụ thể
// ============================================================

export function isCreator(item: { creator_id: string }, userId: string) {
  return item.creator_id === userId;
}

export function isResponsible(item: { owner_id: string | null }, userId: string) {
  return !!item.owner_id && item.owner_id === userId;
}

export function isCoordinator(coordinatorIds: string[], userId: string) {
  return coordinatorIds.includes(userId);
}

// "Người giao việc" theo mục 2: người phân công/điều chỉnh phân công/sửa việc/duyệt đề xuất/hủy/đóng việc.
// Nếu việc chưa từng được giao chính thức (assigned_by_id null), coi người tạo là người giao việc tạm thời.
export function isAssigner(item: { assigned_by_id: string | null; creator_id: string }, userId: string) {
  if (item.assigned_by_id) return item.assigned_by_id === userId;
  return item.creator_id === userId;
}

// Ai được quyền duyệt/từ chối đề xuất (mục 7) hoặc xử lý các thao tác của "Người giao việc" (mục 5, 8):
// ưu tiên assigned_by_id; dự phòng người tạo hoặc Quản lý/BGĐ (tránh việc bị "treo" khi chưa có ai giao chính thức).
export function canReviewProposal(
  item: { assigned_by_id: string | null; creator_id: string },
  reviewerUserId: string,
  reviewerRoleName: string
): boolean {
  if (item.assigned_by_id) return item.assigned_by_id === reviewerUserId;
  return item.creator_id === reviewerUserId || ["BGĐ", "Quản lý"].includes(reviewerRoleName);
}

// Dùng chung cho các quyền "Người giao việc" ở mục 5 (Điều chỉnh phân công, Sửa việc, Hủy việc,
// Yêu cầu xử lý lại, Duyệt hoàn thành) - cùng logic ưu tiên như canReviewProposal.
export const canActAsAssigner = canReviewProposal;

export function slaMinutesFor(priority: string) {
  const table: Record<string, { response: number; resolution: number }> = {
    urgent: { response: 15, resolution: 240 },
    high: { response: 60, resolution: 1440 },
    normal: { response: 240, resolution: 4320 },
    low: { response: 1440, resolution: 10080 },
  };
  return table[priority] ?? table.normal;
}
