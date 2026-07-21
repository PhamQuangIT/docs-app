"use client";
import { useState } from "react";
import PasswordInput from "@/components/PasswordInput";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu không khớp");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Có lỗi xảy ra");
      return;
    }

    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-lg font-semibold mb-4">Đổi mật khẩu</h1>
      <form onSubmit={handleSubmit} className="card space-y-3">
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        {success && (
          <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
            Đổi mật khẩu thành công. Lần đăng nhập sau hãy dùng mật khẩu mới.
          </div>
        )}
        <div>
          <label className="text-xs text-gray-500">Mật khẩu hiện tại</label>
          <PasswordInput className="input mt-1" value={currentPassword} onChange={setCurrentPassword} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Mật khẩu mới (tối thiểu 6 ký tự)</label>
          <PasswordInput className="input mt-1" value={newPassword} onChange={setNewPassword} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Xác nhận mật khẩu mới</label>
          <PasswordInput className="input mt-1" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Đang lưu..." : "Đổi mật khẩu"}
        </button>
      </form>
    </div>
  );
}
