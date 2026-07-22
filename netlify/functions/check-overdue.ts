// Netlify Scheduled Function - tương đương với cron trong vercel.json khi deploy trên Netlify.
// Chạy độc lập với Next.js API route, gọi thẳng logic dùng chung trong src/lib/cron-logic.ts
import "dotenv/config";
import { schedule } from "@netlify/functions";
import { runOverdueCheck, runRecurringGeneration } from "../../src/lib/cron-logic";

// Chạy mỗi 5 phút (giờ UTC) - đổi cron expression tại đây nếu cần lịch khác
export const handler = schedule("*/5 * * * *", async () => {
  const result = await runOverdueCheck();
  console.log("[netlify:check-overdue]", new Date().toISOString(), result);
  const recurring = await runRecurringGeneration();
  console.log("[netlify:recurring-generation]", new Date().toISOString(), recurring);
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, ...result, ...recurring }),
  };
});
