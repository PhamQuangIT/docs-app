import "dotenv/config";
import { runOverdueCheck } from "../src/lib/cron-logic";

async function main() {
  const result = await runOverdueCheck();
  console.log("[cron:check-overdue]", new Date().toISOString(), result);
  process.exit(0);
}

main();
