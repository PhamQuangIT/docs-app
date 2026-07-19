"use client";
import { useEffect, useState } from "react";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role_id: "", department_id: "", position_id: "" });
  const [error, setError] = useState("");

  async function load() {
    setUsers(await (await fetch("/api/users")).json());
    setRoles(await (await fetch("/api/roles")).json());
    setDepartments(await (await fetch("/api/departments")).json());
    setPositions(await (await fetch("/api/positions")).json());
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ full_name: "", email: "", password: "", role_id: "", department_id: "", position_id: "" });
      load();
    } else {
      setError((await res.json()).error);
    }
  }

  async function handleDelete(u: any) {
    if (!confirm(`Vô hiệu hoá tài khoản "${u.full_name}"? Người này sẽ không đăng nhập được nữa, nhưng lịch sử công việc liên quan vẫn được giữ nguyên.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (res.ok) load();
    else alert((await res.json()).error);
  }

  async function handleReactivate(u: any) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true }),
    });
    if (res.ok) load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Quản lý người dùng</h1>
        <button className="btn btn-primary text-sm" onClick={() => setShowForm((s) => !s)}>+ Thêm người dùng</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-3 max-w-md">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <input className="input" placeholder="Họ tên" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" type="password" placeholder="Mật khẩu" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="input" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
            <option value="">-- Vai trò --</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">-- Bộ phận (không bắt buộc) --</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="input" value={form.position_id} onChange={(e) => setForm({ ...form, position_id: e.target.value })}>
            <option value="">-- Vị trí (không bắt buộc) --</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary">Tạo</button>
        </form>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-4 py-2">Họ tên</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Vai trò</th>
              <th className="text-left px-4 py-2">Bộ phận</th>
              <th className="text-left px-4 py-2">Vị trí</th>
              <th className="text-left px-4 py-2">Trạng thái</th>
              <th className="text-left px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-t border-gray-50 ${!u.is_active ? "opacity-50" : ""}`}>
                <td className="px-4 py-2.5 font-medium">{u.full_name}</td>
                <td className="px-4 py-2.5 text-gray-500">{u.email}</td>
                <td className="px-4 py-2.5">{u.role_name}</td>
                <td className="px-4 py-2.5 text-gray-500">{u.department_name ?? "-"}</td>
                <td className="px-4 py-2.5 text-gray-500">{u.position_name ?? "-"}</td>
                <td className="px-4 py-2.5">
                  {u.is_active ? (
                    <span className="badge status-closed">Đang hoạt động</span>
                  ) : (
                    <span className="badge status-cancelled">Đã vô hiệu hoá</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {u.is_active ? (
                    <button onClick={() => handleDelete(u)} className="text-xs text-red-600 hover:underline">
                      Vô hiệu hoá
                    </button>
                  ) : (
                    <button onClick={() => handleReactivate(u)} className="text-xs text-brand-600 hover:underline">
                      Kích hoạt lại
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
