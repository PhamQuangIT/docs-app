import { NextResponse } from "next/server";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET - chỉ Super Admin. KHÔNG trả về giá trị API key thật (bảo mật) - chỉ cho biết đã cấu hình hay chưa.
// Key thật lưu ở biến môi trường Netlify (RESEND_API_KEY), không lưu trong DB/UI.
export async function GET() {
  try {
    const user = await requireUser();
    if (!isSuperAdmin(user.email)) {
      return NextResponse.json({ error: "Chỉ Super Admin mới xem được mục này" }, { status: 403 });
    }
    return NextResponse.json({
      configured: isEmailConfigured(),
      fromEmail: process.env.RESEND_FROM_EMAIL || "DOCS Vận hành <onboarding@resend.dev>",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
