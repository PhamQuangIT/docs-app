import { NextRequest, NextResponse } from "next/server";
import { runOverdueCheck } from "@/lib/cron-logic";

export const dynamic = "force-dynamic";

// GET /api/cron/check-overdue
// Cấu hình Vercel Cron gọi endpoint này mỗi 5 phút (xem vercel.json).
// Bảo vệ bằng header Authorization Bearer CRON_SECRET khi deploy thật.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await runOverdueCheck();
  return NextResponse.json({ ok: true, ...result, checkedAt: new Date().toISOString() });
}
