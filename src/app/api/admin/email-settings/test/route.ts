import { NextRequest, NextResponse } from "next/server";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { testEmailHtml } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

// POST body: { to } - gửi email test để Super Admin xác nhận cấu hình Resend hoạt động
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!isSuperAdmin(user.email)) {
      return NextResponse.json({ error: "Chỉ Super Admin mới dùng được mục này" }, { status: 403 });
    }
    const { to } = await req.json();
    const target = to || user.email;
    const result = await sendEmail({
      to: [target],
      subject: "[Test] Cấu hình gửi email DOCS Vận hành",
      html: testEmailHtml(),
      template: "test",
    });
    if (result.skipped) {
      return NextResponse.json({ error: "RESEND_API_KEY chưa được cấu hình trong Environment Variables của Netlify" }, { status: 400 });
    }
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Gửi email thất bại" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, to: target });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
