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

export function slaMinutesFor(priority: string) {
  const table: Record<string, { response: number; resolution: number }> = {
    urgent: { response: 15, resolution: 240 },
    high: { response: 60, resolution: 1440 },
    normal: { response: 240, resolution: 4320 },
    low: { response: 1440, resolution: 10080 },
  };
  return table[priority] ?? table.normal;
}
