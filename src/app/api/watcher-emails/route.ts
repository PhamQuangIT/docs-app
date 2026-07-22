import { NextRequest, NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/watcher-emails?q=ab  - gợi ý autocomplete cho trường "Email theo dõi" (mục 3.2 Master Prompt)
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 1) return NextResponse.json([]);
    const rows = await all<any>(
      `SELECT email FROM known_watcher_emails WHERE email ILIKE :q ORDER BY used_count DESC, last_used_at DESC LIMIT 8`,
      { q: `%${q}%` }
    );
    return NextResponse.json(rows.map((r) => r.email));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
