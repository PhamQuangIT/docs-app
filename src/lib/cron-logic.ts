import { all, run } from "./db";
import { notify } from "./notify";
import { v4 as uuid } from "uuid";

// Ngưỡng tự động escalate (giờ trễ) theo priority - tương ứng mục 11 SRS
const AUTO_ESCALATE_HOURS: Record<string, number> = {
  urgent: 2,
  high: 8,
  normal: 24,
  low: 48,
};

const DEADLINE_NEAR_HOURS = 2; // cấu hình được ở Setting, mặc định 2h

export async function runOverdueCheck() {
  const results = { markedOverdue: 0, deadlineNearNotified: 0, autoEscalated: 0 };

  // 1) Đánh dấu quá hạn + thông báo
  const toMarkOverdue = await all<any>(
    `SELECT * FROM work_items
     WHERE is_overdue = false
     AND status NOT IN ('completed','closed','cancelled')
     AND deadline < NOW()`
  );
  for (const item of toMarkOverdue) {
    await run(`UPDATE work_items SET is_overdue = true, updated_at = NOW() WHERE id = :id`, { id: item.id });
    if (item.owner_id) await notify(item.owner_id, "overdue", `Việc "${item.title}" đã QUÁ HẠN`, item.id);
    // Thông báo Quản lý/BGĐ cùng phòng ban
    const leaders = await all<any>(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name IN ('Quản lý','BGĐ')
       AND (u.department_id = :dept OR :dept2::text IS NULL)`,
      { dept: item.department_id, dept2: item.department_id }
    );
    for (const l of leaders) await notify(l.id, "overdue", `Việc "${item.title}" đã QUÁ HẠN`, item.id);
    results.markedOverdue++;
  }

  // 2) Cảnh báo gần đến hạn (chưa từng thông báo deadline_near cho item này)
  const nearDeadlineItems = await all<any>(
    `SELECT wi.* FROM work_items wi
     WHERE wi.status NOT IN ('completed','closed','cancelled')
     AND wi.is_overdue = false
     AND wi.deadline <= NOW() + INTERVAL '${DEADLINE_NEAR_HOURS} hours'
     AND wi.deadline > NOW()
     AND NOT EXISTS (
       SELECT 1 FROM notifications n WHERE n.work_item_id = wi.id AND n.type = 'deadline_near'
     )`
  );
  for (const item of nearDeadlineItems) {
    if (item.owner_id) await notify(item.owner_id, "deadline_near", `Việc "${item.title}" sắp đến hạn (còn ${DEADLINE_NEAR_HOURS}h)`, item.id);
    results.deadlineNearNotified++;
  }

  // 3) Tự động escalate khi quá hạn vượt ngưỡng theo priority và chưa từng auto-escalate
  const overdueUnescalated = await all<any>(
    `SELECT wi.* FROM work_items wi
     WHERE wi.is_overdue = true
     AND wi.status NOT IN ('completed','closed','cancelled')
     AND NOT EXISTS (
       SELECT 1 FROM escalations e WHERE e.work_item_id = wi.id AND e.is_auto = true
     )`
  );
  for (const item of overdueUnescalated) {
    const thresholdHours = AUTO_ESCALATE_HOURS[item.priority] ?? 24;
    const hoursOverdue = (Date.now() - new Date(item.deadline).getTime()) / 3600000;
    if (hoursOverdue < thresholdHours) continue;

    // Escalate lên Quản lý của phòng ban; nếu không có, escalate lên BGĐ
    const leaderRows = await all<any>(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'Quản lý' AND u.department_id = :dept LIMIT 1`,
      { dept: item.department_id }
    );
    let target = leaderRows[0];
    if (!target) {
      const omRows = await all<any>(
        `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'BGĐ' LIMIT 1`
      );
      target = omRows[0];
    }
    if (!target) continue;

    await run(
      `INSERT INTO escalations (id, work_item_id, escalated_from, escalated_to, reason, is_auto)
       VALUES (:id, :wi, NULL, :to_user, :reason, true)`,
      {
        id: uuid(),
        wi: item.id,
        to_user: target.id,
        reason: `Tự động: quá hạn ${hoursOverdue.toFixed(1)}h, vượt ngưỡng ${thresholdHours}h cho priority ${item.priority}`,
      }
    );
    await notify(target.id, "escalation", `[Tự động] Việc "${item.title}" cần bạn hỗ trợ do quá hạn`, item.id);
    results.autoEscalated++;
  }

  return results;
}
