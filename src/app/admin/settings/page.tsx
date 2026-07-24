"use client";
import { useEffect, useState } from "react";

export default function AdminSettingsPage() {
  const [status, setStatus] = useState<any>(null);
  const [testTo, setTestTo] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/admin/email-settings").then(async (r) => {
      if (r.ok) setStatus(await r.json());
      else setError((await r.json()).error);
    });
  }, []);

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setError(""); setMsg("");
    const res = await fetch("/api/admin/email-settings/test", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: testTo || undefined }),
    });
    setSending(false);
    if (res.ok) setMsg("Đã gửi email test thành công, kiểm tra hộp thư!");
    else setError((await res.json()).error);
  }

  if (error && !status) return <div className="text-sm text-red-600">{error}</div>;
  if (!status) return <div className="text-gray-400 text-sm">Đang tải...</div>;

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-bold text-slate-800">⚙️ Cài đặt hệ thống (Super Admin)</h1>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Cấu hình gửi Email (Resend)</h3>
        <p className="text-sm text-gray-600 mb-1">
          Trạng thái: {status.configured ? <span className="text-green-600 font-semibold">✅ Đã cấu hình</span> : <span className="text-red-600 font-semibold">❌ Chưa cấu hình</span>}
        </p>
        <p className="text-xs text-gray-400 mb-3">Gửi từ: {status.fromEmail}</p>
        {!status.configured && (
          <div className="text-sm bg-amber-50 text-amber-800 rounded-lg px-3 py-2 mb-3">
            Vì lý do bảo mật, khóa API (RESEND_API_KEY) không được lưu/hiển thị trực tiếp trong ứng dụng.
            Vào <b>Netlify → Site settings → Environment variables</b>, thêm biến <code>RESEND_API_KEY</code>
            (đăng ký miễn phí tại resend.com, gói free 3.000 email/tháng), rồi deploy lại.
          </div>
        )}
        <form onSubmit={sendTest} className="flex gap-2">
          <input className="input" placeholder="Email nhận thử (để trống = gửi cho chính bạn)" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <button type="submit" className="btn btn-primary text-sm whitespace-nowrap" disabled={sending}>{sending ? "Đang gửi..." : "Gửi email test"}</button>
        </form>
        {msg && <p className="text-sm text-green-700 mt-2">{msg}</p>}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}
