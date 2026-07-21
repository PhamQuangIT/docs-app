"use client";
import { useEffect, useState } from "react";
import DepartmentSelect from "@/components/DepartmentSelect";
import PasswordInput from "@/components/PasswordInput";

const KHAC_POSITION_NAME = "Khác";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role_id: "", department_id: "", position_id: "" });
  const [customPositionText, setCustomPositionText] = useState("");
  const [error, setError] = useState("");

  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ full_name: "", role_id: "", department_id: "", position_id: "" });
  const [editCustomPositionText, setEditCustomPositionText] = useState("");
  const [editError, setEditError] = useState("");

  async function load() {
    setUsers(await (await fetch("/api/users")).json());
    setRoles(await (await fetch("/api/roles")).json());
    setDepartments(await (await fetch("/api/departments")).json());
    setPositions(await (await fetch("/api/positions")).json());
  }

  useEffect(() => { load(); }, []);

  const khacPosition = positions.find((p) => p.name === KHAC_POSITION_NAME);
  const isKhacSelected = form.position_id === khacPosition?.id;
  const isEditKhacSelected = editForm.position_id === khacPosition?.id;

  async function resolvePositionId(positionId: string, customText: string): Promise<{ id?: string; error?: string }> {
    if (positionId === khacPosition?.id && customText.trim()) {
      const posRes = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customText.trim() }),
      });
      if (!posRes.ok) return { error: (await posRes.json()).error || "Không tạo được vị trí mới" };
      return { id: (await posRes.json()).id };
    }
    return { id: positionId || undefined };
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const resolved = await resolvePositionId(form.position_id, customPositionText);
    if (resolved.error) { setError(resolved.error); return; }

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, position_id: resolved.id }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ full_name: "", email: "", password: "", role_id: "", department_id: "", position_id: "" });
      setCustomPositionText("");
      load();
    } else {
      setError((await res.json()).error);
    }
  }

  function openEdit(u: any) {
    setEditingUser(u);
    setEditForm({
      full_name: u.full_name,
      role_id: roles.find((r) => r.name === u.role_name)?.id ?? "",
      department_id: u.department_id ?? "",
      position_id: u.position_id ?? "",
    });
    setEditCustomPositionText("");
    setEditError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");

    const resolved = await resolvePositionId(editForm.position_id, editCustomPositionText);
    if (resolved.error) { setEditError(resolved.error); return; }

    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: editForm.full_name,
        role_id: editForm.role_id,
        department_id: editForm.department_id || null,
        position_id: resolved.id || null,
      }),
    });
    if (res.ok) {
      setEditingUser(null);
      load();
    } else {
      setEditError((await res.json()).error);
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
          <PasswordInput className="input" placeholder="Mật khẩu" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <select className="input" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
            <option value="">-- Vai trò --</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <DepartmentSelect
            departments={departments}
            value={form.department_id}
            onChange={(v) => setForm({ ...form, department_id: v })}
            allLabel="-- Bộ phận --"
          />
          <select
            className="input"
            value={form.position_id}
            onChange={(e) => setForm({ ...form, position_id: e.target.value })}
          >
            <option value="">-- Vị trí --</option>
            {positions.filter((p) => p.name !== "Khách hàng").map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {isKhacSelected && (
            <input
              className="input"
              placeholder="Nhập tên chức danh cụ thể..."
              value={customPositionText}
              onChange={(e) => setCustomPositionText(e.target.value)}
            />
          )}
          <button className="btn btn-primary">Tạo</button>
        </form>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 p-4">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-xl shadow-lg w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Sửa: {editingUser.full_name}</h2>
              <button type="button" onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {editError && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{editError}</div>}
            <p className="text-xs text-gray-400">Email: {editingUser.email} (không đổi được email ở đây)</p>
            <div>
              <label className="text-xs text-gray-500">Họ tên</label>
              <input className="input mt-1" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Vai trò</label>
              <select className="input mt-1" value={editForm.role_id} onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Bộ phận</label>
              <DepartmentSelect
                departments={departments}
                value={editForm.department_id}
                onChange={(v) => setEditForm({ ...editForm, department_id: v })}
                allLabel="-- Không chọn --"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Vị trí</label>
              <select
                className="input mt-1"
                value={editForm.position_id}
                onChange={(e) => setEditForm({ ...editForm, position_id: e.target.value })}
              >
                <option value="">-- Không chọn --</option>
                {positions.filter((p) => p.name !== "Khách hàng").map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {isEditKhacSelected && (
                <input
                  className="input mt-2"
                  placeholder="Nhập tên chức danh cụ thể..."
                  value={editCustomPositionText}
                  onChange={(e) => setEditCustomPositionText(e.target.value)}
                />
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingUser(null)} className="btn btn-secondary">Hủy</button>
              <button type="submit" className="btn btn-primary">Lưu</button>
            </div>
          </form>
        </div>
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
                <td className="px-4 py-2.5 text-right space-x-3">
                  {u.is_active && (
                    <button onClick={() => openEdit(u)} className="text-xs text-brand-600 hover:underline">
                      Sửa
                    </button>
                  )}
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
