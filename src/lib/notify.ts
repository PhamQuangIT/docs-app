import { run } from "./db";
import { v4 as uuid } from "uuid";

export type NotificationType =
  | "created"
  | "assigned"
  | "comment"
  | "deadline_near"
  | "overdue"
  | "status_change"
  | "escalation";

export async function notify(userId: string, type: NotificationType, message: string, workItemId?: string) {
  if (!userId) return;
  await run(
    `INSERT INTO notifications (id, user_id, work_item_id, type, message)
     VALUES (:id, :user_id, :work_item_id, :type, :message)`,
    { id: uuid(), user_id: userId, work_item_id: workItemId ?? null, type, message }
  );
}
