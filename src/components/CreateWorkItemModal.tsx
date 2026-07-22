"use client";
import { useEffect, useRef, useState } from "react";
import DepartmentSelect from "./DepartmentSelect";

const TYPE_OPTIONS = [
  { value: "issue", label: "Sự cố" },
  { value: "customer_request", label: "Yêu cầu khách hàng" },
  { value: "task", label: "Công việc" },
  { value: "meeting_action", label: "Action họp" },
  { value: "management_task", label: "Việc BGD/liên phòng ban" },
];

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Khẩn cấp" },
  { value: "high", label: "Cao" },
  { value: "normal", label: "Bình thường" },
  { value: "low", label: "Thấp" },
];

const RECURRENCE_OPTIONS = [
  { value: "once", label: "Một lần (mặc định)" },
  { value: "daily", label: "Hàng ngày" },
  { value: "weekly", label: "Hàng tuần" },
  { value: "monthly", label: "Hàng tháng" },
  { value: "yearly", label: "Hàng năm" },
];

// Preset nhanh cho các tình huống lặp lại thường xuyên - bấm 1 cái điền sẵn Loại + Ưu tiên + Tiêu đề gợi ý
const QUICK_PRESETS = [
  { label: "Thiếu nhân lực", type: "issue", priority: "urgent", title: "Thiếu nhân lực ca " },
  { label: "Máy/thiết bị hỏng", type: "issue", priority: "high", title: "Sự cố máy/thiết bị: " },
  { label: "KH đổi kế hoạch", type: "customer_request", priority: "urgent", title: "Khách hàng thay đổi kế hoạch: " },
  { label: "KH yêu cầu bổ sung", type: "customer_request", priority: "high", title: "Khách hàng yêu cầu bổ sung nhân lực: " },
];

function defaultDeadline(hoursFromNow: number) {
  const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
  d.setSeconds(0, 0);
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

export default function CreateWorkItemModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState("issue");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("normal");
  const [deadline, setDeadline] = useState(defaultDeadline(24));
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [coordinatorIds, setCoordinatorIds] = useState<string[]>([]);
  const [reportToId, setReportToId] = useState("");
  const [reportToCustomText, setReportToCustomText] = useState("");
  const [recurrence, setRecurrence] = useState("once");
  const [watcherEmail, setWatcherEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"draft" | "assign" | false>(false);
  const [showMore, setShowMore] = useState(false);

  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/departments").then((r) => r.json()).then(setDepartments).catch(() => {});
    fetch("/api/positions").then((r) => r.json()).then(setPositions).catch(() => {});
    fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {});
  }, []);

  const khacPosition = positions.find((p) => p.name === "Khác");
  const isReportToKhac = reportToId === khacPosition?.id;

  function applyPreset(p: (typeof QUICK_PRESETS)[number]) {
    setType(p.type);
    setPriority(p.priority);
    setTitle(p.title);
  }

  function toggleCoordinator(userId: string) {
    setCoordinatorIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleSubmit(e: React.FormEvent, saveAsDraft: boolean) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề");
      return;
    }
    if (!saveAsDraft && !ownerId) {
      setError("Vui lòng chọn Người chịu trách nhiệm chính (hoặc bấm Lưu nháp nếu chưa xác định được người)");
      return;
    }
    setLoading(saveAsDraft ? "draft" : "assign");
    setError("");

    let finalReportToId = reportToId;
    if (isReportToKhac && reportToCustomText.trim()) {
      const posRes = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: reportToCustomText.trim() }),
      });
      if (!posRes.ok) {
        setLoading(false);
        setError((await posRes.json()).error || "Không tạo được chức danh mới");
        return;
      }
      finalReportToId = (await posRes.json()).id;
    }

    const res = await fetch("/api/work-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        title,
        priority,
        deadline: new Date(deadline).toISOString(),
        description: description || undefined,
        department_id: departmentId || undefined,
        position_id: positionId || undefined,
        owner_id: ownerId || undefined,
        coordinator_ids: coordinatorIds,
        report_to_id: finalReportToId || undefined,
        save_as_draft: saveAsDraft,
        recurrence,
        watcher_email: watcherEmail || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Có lỗi xảy ra");
      return;
    }
    onCreated();
  }

  return (
    // OVERLAY: items-start (không phải items-center) + overflow-y-auto + padding, để form dài vẫn kéo được
    // lên tới sát mép trên khi cuộn (tránh lỗi che mất Header đã gặp trước đây).
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* MODAL CONTAINER: flex-col + max-height giới hạn theo viewport, margin-y auto để tự căn giữa
          khi nội dung ngắn hơn viewport, nhưng vẫn cuộn đúng khi nội dung dài hơn viewport. */}
      <form
        onSubmit={(e) => handleSubmit(e, false)}
        className="bg-white rounded-lg shadow-lg w-full flex flex-col my-auto"
        style={{ maxWidth: 650, maxHeight: "calc(100vh - 32px)" }}
      >
        {/* HEADER - cố định, không cuộn theo */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Tạo phát sinh mới</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* BODY - phần duy nhất cuộn được */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

          <div>
            <label className="text-xs text-gray-500">Chọn nhanh tình huống thường gặp</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {QUICK_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Loại phát sinh *</label>
            <select className="input mt-1" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Tiêu đề *</label>
            <input
              className="input mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Thiếu 2 nhân viên ca sáng tổ Picking"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Mức ưu tiên *</label>
              <select className="input mt-1" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Deadline *</label>
              <input
                type="datetime-local"
                className="input mt-1"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Loại thời hạn</label>
            <select className="input mt-1" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {recurrence !== "once" && (
              <p className="text-xs text-gray-400 mt-1">
                Hệ thống sẽ tự động tạo việc mới lặp lại theo chu kỳ này, tính từ Deadline ở trên.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500">Người chịu trách nhiệm chính *</label>
            <select className="input mt-1" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">-- Chọn người (bắt buộc để giao việc ngay) --</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role_name})</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Chưa xác định được người phù hợp? Bấm &quot;Lưu nháp&quot; bên dưới, giao sau cũng được.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className="text-xs text-brand-600 hover:underline"
          >
            {showMore ? "Ẩn bớt" : "+ Thêm người phối hợp / vị trí / báo cáo cho / email theo dõi"}
          </button>

          {showMore && (
            <div className="space-y-3 bg-gray-50 rounded-lg p-3">
              <div>
                <label className="text-xs text-gray-500">Người phối hợp (có thể chọn nhiều)</label>
                <div className="mt-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-white p-2 space-y-1">
                  {users.filter((u) => u.id !== ownerId).map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={coordinatorIds.includes(u.id)}
                        onChange={() => toggleCoordinator(u.id)}
                      />
                      {u.full_name} <span className="text-gray-400 text-xs">({u.role_name})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Bộ phận / nhóm</label>
                <DepartmentSelect
                  departments={departments}
                  value={departmentId}
                  onChange={setDepartmentId}
                  className="input mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Vị trí chịu trách nhiệm</label>
                <select className="input mt-1" value={positionId} onChange={(e) => setPositionId(e.target.value)}>
                  <option value="">-- Không chọn --</option>
                  {positions
                    .filter((p) => p.name !== "Khác" && p.name !== "Khách hàng")
                    .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
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
                <label className="text-xs text-gray-500">Email theo dõi (báo cho người ngoài hệ thống, nếu có)</label>
                <div className="mt-1">
                  <EmailAutocomplete value={watcherEmail} onChange={setWatcherEmail} />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500">Mô tả (không bắt buộc)</label>
            <textarea
              className="input mt-1"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* FOOTER - cố định, không cuộn theo */}
        <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn btn-secondary">Hủy</button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any, true)}
            className="btn btn-secondary"
            disabled={!!loading}
          >
            {loading === "draft" ? "Đang lưu..." : "Lưu nháp"}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!!loading}>
            {loading === "assign" ? "Đang tạo..." : "Tạo và giao việc"}
          </button>
        </div>
      </form>
    </div>
  );
}
