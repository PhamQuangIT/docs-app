// Mẫu email HTML cho Lịch họp (mục 5 Master Prompt 23/07/2026) - thiết kế đơn giản, chuyên nghiệp,
// dùng inline-style để tương thích tốt với hầu hết ứng dụng đọc email.

function wrapper(title: string, accent: string, bodyHtml: string) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color:#1e293b;">
    <div style="border-top: 4px solid ${accent}; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      <div style="background:#f8fafc; padding: 20px 24px;">
        <h2 style="margin:0; font-size: 18px; color:${accent};">${title}</h2>
      </div>
      <div style="padding: 20px 24px; background:#ffffff;">
        ${bodyHtml}
      </div>
      <div style="padding: 12px 24px; background:#f8fafc; font-size: 11px; color:#94a3b8;">
        Email tự động từ hệ thống DOCS · Vận hành - vui lòng không trả lời trực tiếp email này.
      </div>
    </div>
  </div>`;
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TYPE_LABEL: Record<string, string> = {
  team: "Họp nhóm",
  production_direct: "Họp bộ phận sản xuất",
  production_indirect: "Họp bộ phận gián tiếp",
  department: "Họp phòng",
  board: "Họp Ban Giám Đốc",
};

export function meetingInviteHtml(m: { title: string; meeting_type: string; start_time: string; end_time: string; location?: string; agenda?: string; host_name?: string }) {
  return wrapper(
    "📅 Thư mời họp",
    "#2563eb",
    `
    <p>Bạn được mời tham dự cuộc họp sau:</p>
    <table style="width:100%; font-size:14px; border-collapse:collapse;">
      <tr><td style="padding:4px 0; color:#64748b; width:140px;">Tiêu đề</td><td style="font-weight:600;">${m.title}</td></tr>
      <tr><td style="padding:4px 0; color:#64748b;">Loại họp</td><td>${TYPE_LABEL[m.meeting_type] ?? m.meeting_type}</td></tr>
      <tr><td style="padding:4px 0; color:#64748b;">Thời gian</td><td>${fmt(m.start_time)} - ${fmt(m.end_time)}</td></tr>
      <tr><td style="padding:4px 0; color:#64748b;">Địa điểm</td><td>${m.location ?? "(chưa cập nhật)"}</td></tr>
      <tr><td style="padding:4px 0; color:#64748b;">Người tổ chức</td><td>${m.host_name ?? "-"}</td></tr>
    </table>
    ${m.agenda ? `<div style="margin-top:14px;"><div style="color:#64748b; font-size:13px; margin-bottom:4px;">Nội dung / Chương trình họp:</div><div style="white-space:pre-wrap; font-size:14px;">${m.agenda}</div></div>` : ""}
  `
  );
}

export function meetingRescheduleHtml(m: { title: string; old_start_time: string; new_start_time: string; new_end_time: string; location?: string; reason: string }) {
  return wrapper(
    "🔄 Thông báo dời lịch họp",
    "#eab308",
    `
    <p>Cuộc họp <b>${m.title}</b> đã được dời lịch:</p>
    <table style="width:100%; font-size:14px; border-collapse:collapse;">
      <tr><td style="padding:4px 0; color:#64748b; width:140px;">Thời gian cũ</td><td style="text-decoration:line-through; color:#94a3b8;">${fmt(m.old_start_time)}</td></tr>
      <tr><td style="padding:4px 0; color:#64748b;">Thời gian mới</td><td style="font-weight:600; color:#2563eb;">${fmt(m.new_start_time)} - ${fmt(m.new_end_time)}</td></tr>
      <tr><td style="padding:4px 0; color:#64748b;">Địa điểm</td><td>${m.location ?? "(chưa cập nhật)"}</td></tr>
    </table>
    <div style="margin-top:14px; padding:12px; background:#fefce8; border-radius:6px; font-size:13px;">
      <b>Lý do:</b> ${m.reason}
    </div>
  `
  );
}

export function meetingCancelHtml(m: { title: string; start_time: string; reason: string }) {
  return wrapper(
    "❌ Thông báo hủy họp",
    "#ef4444",
    `
    <p>Cuộc họp sau đã bị <b style="color:#ef4444;">HỦY</b>:</p>
    <table style="width:100%; font-size:14px; border-collapse:collapse;">
      <tr><td style="padding:4px 0; color:#64748b; width:140px;">Tiêu đề</td><td style="font-weight:600;">${m.title}</td></tr>
      <tr><td style="padding:4px 0; color:#64748b;">Thời gian đã định</td><td>${fmt(m.start_time)}</td></tr>
    </table>
    <div style="margin-top:14px; padding:12px; background:#fef2f2; border-radius:6px; font-size:13px;">
      <b>Lý do hủy:</b> ${m.reason}
    </div>
  `
  );
}

export function testEmailHtml() {
  return wrapper("✅ Email test cấu hình thành công", "#22c55e", `<p>Đây là email kiểm tra cấu hình Resend API Key từ trang Cài đặt Quản trị. Nếu bạn nhận được email này, cấu hình gửi email đã hoạt động đúng.</p>`);
}
