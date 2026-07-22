"use client";
import { useEffect, useState } from "react";
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 p-4 overflow-y-auto">
      <form onSubmit={(e) => handleSubmit(e, false)} className="bg-white rounded-xl shadow-lg w-full max-w-md p-5 space-y-3 my-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Tạo phát sinh mới</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
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
          {showMore ? "Ẩn bớt" : "+ Thêm người phối hợp / vị trí / báo cáo cho"}
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

        <div className="flex justify-end gap-2 pt-2">
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
