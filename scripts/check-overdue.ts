import "dotenv/config";
import { runOverdueCheck, runRecurringGeneration } from "../src/lib/cron-logic";

async function main() {
  const result = await runOverdueCheck();
  console.log("[cron:check-overdue]", new Date().toISOString(), result);
  const recurring = await runRecurringGeneration();
  console.log("[cron:recurring-generation]", new Date().toISOString(), recurring);
  process.exit(0);
}

main();
