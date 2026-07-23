"use client";
import { useEffect, useRef, useState } from "react";
import DepartmentSelect from "./DepartmentSelect";

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Khẩn cấp" },
  { value: "high", label: "Cao" },
  { value: "normal", label: "Bình thường" },
  { value: "low", label: "Thấp" },
];

const RECURRENCE_OPTIONS = [
  { value: "once", label: "Một lần" },
  { value: "daily", label: "Hàng ngày" },
  { value: "weekly", label: "Hàng tuần" },
  { value: "monthly", label: "Hàng tháng" },
  { value: "yearly", label: "Hàng năm" },
];

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function EmailAutocomplete({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 1) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/watcher-emails?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: string[]) => setSuggestions(rows.filter((e) => e.toLowerCase() !== q.toLowerCase())))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="email"
        className="input"
        placeholder="ten@congty.com (không bắt buộc)"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => { onChange(s); setOpen(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EditAssignmentModal({
  item,
  onClose,
  onSaved,
}: {
  item: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [priority, setPriority] = useState(item.priority);
  const [deadline, setDeadline] = useState(toLocalInputValue(item.deadline));
  const [recurrence, setRecurrence] = useState(item.recurrence ?? "once");
  const [ownerId, setOwnerId] = useState(item.owner_id ?? "");
  const [coordinatorIds, setCoordinatorIds] = useState<string[]>((item.coordinators ?? []).map((c: any) => c.id));
  const [departmentId, setDepartmentId] = useState(item.department_id ?? "");
  const [positionId, setPositionId] = useState(item.position_id ?? "");
  const [customerId, setCustomerId] = useState(item.customer_id ?? "");
  const [reportToId, setReportToId] = useState(item.report_to_id ?? "");
  const [reportToCustomText, setReportToCustomText] = useState("");
  const [watcherEmail, setWatcherEmail] = useState(item.watcher_email ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/departments").then((r) => r.json()).then(setDepartments).catch(() => {});
    fetch("/api/positions").then((r) => r.json()).then(setPositions).catch(() => {});
    fetch("/api/customers").then((r) => r.json()).then(setCustomers).catch(() => {});
    fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {});
  }, []);

  const khacPosition = positions.find((p) => p.name === "Khác");
  const isReportToKhac = reportToId === khacPosition?.id;
  const reasonRequired = !!item.owner_id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Vui lòng nhập tiêu đề"); return; }
    if (reasonRequired && !reason.trim()) { setError("Vui lòng nêu lý do điều chỉnh (bắt buộc vì việc đã có người chịu trách nhiệm)"); return; }
    if (!ownerId) { setError("Vui lòng chọn Người chịu trách nhiệm chính"); return; }

    setSaving(true);
    let finalReportToId = reportToId;
    if (isReportToKhac && reportToCustomText.trim()) {
      const posRes = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: reportToCustomText.trim() }),
      });
      if (!posRes.ok) {
        setSaving(false);
        setError((await posRes.json()).error || "Không tạo được chức danh mới");
        return;
      }
      finalReportToId = (await posRes.json()).id;
    }

    // 1) Cập nhật nội dung việc (mọi trường trừ owner_id)
    const editRes = await fetch(`/api/work-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        priority,
        deadline: new Date(deadline).toISOString(),
        recurrence,
        department_id: departmentId || null,
        position_id: positionId || null,
        customer_id: customerId || null,
        report_to_id: finalReportToId || null,
        watcher_email: watcherEmail || null,
        coordinator_ids: coordinatorIds,
        reason: reason || undefined,
      }),
    });
    if (!editRes.ok) {
      setSaving(false);
      setError((await editRes.json()).error || "Có lỗi khi lưu nội dung việc");
      return;
    }

    // 2) Nếu người chịu trách nhiệm chính thay đổi -> gọi riêng API Điều chỉnh phân công
    if (ownerId !== (item.owner_id ?? "")) {
      const assignRes = await fetch(`/api/work-items/${item.id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_id: ownerId, reason: reason || undefined }),
      });
      if (!assignRes.ok) {
        setSaving(false);
        setError((await assignRes.json()).error || "Có lỗi khi đổi người chịu trách nhiệm chính");
        return;
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-lg w-full flex flex-col my-auto"
        style={{ maxWidth: 650, maxHeight: "calc(100vh - 32px)" }}
      >
        {/* HEADER cố định */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Điều chỉnh phân công</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* BODY cuộn */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

          <div>
            <label className="text-xs text-gray-500">Tên công việc *</label>
            <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Mô tả chi tiết</label>
            <textarea className="input mt-1" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Mức độ ưu tiên *</label>
              <select className="input mt-1" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Deadline (Ngày & Giờ) *</label>
              <input type="datetime-local" className="input mt-1" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Loại thời hạn</label>
            <select className="input mt-1" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Người chịu trách nhiệm chính *</label>
            <select className="input mt-1" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">-- Chọn người --</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role_name})</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Người phối hợp (có thể chọn nhiều)</label>
            <div className="mt-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-white p-2 space-y-1">
              {users.filter((u) => u.id !== ownerId).map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={coordinatorIds.includes(u.id)}
                    onChange={() =>
                      setCoordinatorIds((prev) => (prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]))
                    }
                  />
                  {u.full_name} <span className="text-gray-400 text-xs">({u.role_name})</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Báo cáo cho (chức danh)</label>
            <select className="input mt-1" value={reportToId} onChange={(e) => setReportToId(e.target.value)}>
              <option value="">-- Không chọn --</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {isReportToKhac && (
              <input
                className="input mt-2"
                placeholder="Nhập tên chức danh cụ thể..."
                value={reportToCustomText}
                onChange={(e) => setReportToCustomText(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500">Bộ phận</label>
            <DepartmentSelect departments={departments} value={departmentId} onChange={setDepartmentId} className="input mt-1" />
          </div>

          <div>
            <label className="text-xs text-gray-500">Vị trí chịu trách nhiệm</label>
            <select className="input mt-1" value={positionId} onChange={(e) => setPositionId(e.target.value)}>
              <option value="">-- Không chọn --</option>
              {positions.filter((p) => p.name !== "Khác" && p.name !== "Khách hàng").map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Khách hàng</label>
            <select className="input mt-1" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">-- Không chọn --</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Email theo dõi</label>
            <div className="mt-1"><EmailAutocomplete value={watcherEmail} onChange={setWatcherEmail} /></div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="text-xs font-medium text-gray-700">
              Lý do điều chỉnh {reasonRequired && <span className="text-red-500">*</span>}
            </label>
            <textarea
              className="input mt-1"
              rows={2}
              placeholder="Ghi rõ lý do thay đổi để lưu vào lịch sử..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        {/* FOOTER cố định */}
        <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn btn-secondary">Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}
