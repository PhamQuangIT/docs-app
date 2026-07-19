export function PriorityBadge({ priority }: { priority: string }) {
  const labels: Record<string, string> = {
    urgent: "Khẩn cấp",
    high: "Cao",
    normal: "Bình thường",
    low: "Thấp",
  };
  return <span className={`badge badge-${priority}`}>{labels[priority] ?? priority}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    new: "Mới",
    assigned: "Đã giao",
    doing: "Đang xử lý",
    waiting: "Chờ",
    completed: "Hoàn thành",
    closed: "Đã đóng",
    cancelled: "Đã hủy",
  };
  return <span className={`badge status-${status}`}>{labels[status] ?? status}</span>;
}

export function TypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    issue: "Sự cố",
    task: "Công việc",
    customer_request: "Yêu cầu KH",
    meeting_action: "Action họp",
    management_task: "Việc BGD",
  };
  return <span className="text-xs text-gray-500">{labels[type] ?? type}</span>;
}
