import { run } from "./db";
import { v4 as uuid } from "uuid";

// Hạ tầng gửi email dùng Resend (miễn phí 3.000 email/tháng) - mục 5 Master Prompt 23/07/2026.
// Đọc RESEND_API_KEY từ biến môi trường (KHÔNG lưu key trong DB/UI để tránh lộ secret) - cấu hình
// tại Netlify: Site settings -> Environment variables -> RESEND_API_KEY (và tuỳ chọn RESEND_FROM_EMAIL).
const RESEND_API_URL = "https://api.resend.com/emails";

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
  template: string; // 'meeting_invite' | 'meeting_reschedule' | 'meeting_cancel' | 'test'
  relatedMeetingId?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const { to, subject, html, template, relatedMeetingId } = opts;
  const validTo = to.filter(Boolean);

  if (validTo.length === 0) {
    return { ok: false, error: "Không có email người nhận hợp lệ" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY chưa cấu hình - bỏ qua gửi mail "${subject}" tới ${validTo.join(", ")}`);
    await logEmail(validTo, subject, template, "skipped", "RESEND_API_KEY chưa cấu hình", relatedMeetingId);
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "DOCS Vận hành <onboarding@resend.dev>",
        to: validTo,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      await logEmail(validTo, subject, template, "failed", errText, relatedMeetingId);
      return { ok: false, error: errText };
    }
    await logEmail(validTo, subject, template, "sent", null, relatedMeetingId);
    return { ok: true };
  } catch (e: any) {
    await logEmail(validTo, subject, template, "failed", e.message, relatedMeetingId);
    return { ok: false, error: e.message };
  }
}

async function logEmail(
  to: string[],
  subject: string,
  template: string,
  status: "sent" | "failed" | "skipped",
  error: string | null,
  relatedMeetingId?: string
) {
  try {
    await run(
      `INSERT INTO email_log (id, to_emails, subject, template, status, error, related_meeting_id)
       VALUES (:id, :to_emails, :subject, :template, :status, :error, :related_meeting_id)`,
      { id: uuid(), to_emails: to, subject, template, status, error, related_meeting_id: relatedMeetingId ?? null }
    );
  } catch (e) {
    console.error("[email] Không ghi được email_log:", e);
  }
}
