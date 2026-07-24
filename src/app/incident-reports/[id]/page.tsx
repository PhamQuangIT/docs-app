"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const SEVERITY_LABEL: Record<string, string> = { light: "Nhẹ", medium: "Trung bình", serious: "Nghiêm trọng", critical: "Rất nghiêm trọng / Dừng vận hành" };
const STATUS_LABEL: Record<string, string> = {
  pending_team_lead: "Chờ Trưởng nhóm duyệt", pending_deputy: "Chờ Phó phòng duyệt",
  pending_department_head: "Chờ Trưởng phòng duyệt", pending_director: "Chờ Giám đốc/Trợ lý GĐ duyệt",
  approved: "Đã duyệt", rejected: "Đã từ chối", cancelled: "Đã hủy",
};
function fmt(dt: string) { return dt ? new Date(dt).toLocaleString("vi-VN") : "-"; }

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState("");
  const [showGenTask, setShowGenTask] = useState(false);
  const [taskDeadline, setTaskDeadline] = useState("");

  async function load() {
    const res = await fetch(`/api/incident-reports/${id}`);
    if (res.ok) setItem(await res.json());
  }
  useEffect(() => { load(); fetch("/api/auth/me").then((r) => r.json()).then(setMe); }, [id]);

  if (!item) return <div className="text-gray-400 text-sm">Đang tải...</div>;

  async function approve() {
    setError("");
    const res = await fetch(`/api/incident-reports/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (res.ok) load(); else setError((await res.json()).error);
  }
  async function reject() {
    const reason = prompt("Lý do từ chối (bắt buộc):");
    if (!reason) return;
    setError("");
    const res = await fetch(`/api/incident-reports/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    if (res.ok) load(); else setError((await res.json()).error);
  }
  async function generateTask() {
    setError("");
    const res = await fetch(`/api/incident-reports/${id}/generate-task`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline: taskDeadline ? new Date(taskDeadline).toISOString() : undefined }),
    });
    if (res.ok) { setShowGenTask(false); load(); } else setError((await res.json()).error);
  }

  const isPending = item.status.startsWith("pending_");
  const canGenerateTask = ["pending_director", "approved"].includes(item.status) && !item.generated_task_id;

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Quay lại</button>
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-orange-600">⚠️ {SEVERITY_LABEL[item.severity]}</span>
            <h1 className="text-lg font-semibold text-gray-800 mt-1">{item.title}</h1>
          </div>
          <span className="text-xs text-slate-500">{STATUS_LABEL[item.status]}</span>
        </div>
        <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{item.description}</p>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div><span className="text-gray-400">Người báo cáo:</span> {item.creator_name}</div>
          <div><span className="text-gray-400">Bộ phận:</span> {item.department_name ?? "-"}</div>
          {item.root_cause && <div className="col-span-2"><span className="text-gray-400">Nguyên nhân:</span> {item.root_cause}</div>}
          {item.capa && <div className="col-span-2"><span className="text-gray-400">Đối sách:</span> {item.capa}</div>}
          {item.capa_deadline && <div><span className="text-gray-400">Hạn thực hiện đối sách:</span> {fmt(item.capa_deadline)}</div>}
          {item.reject_reason && <div className="col-span-2 text-red-600"><span className="text-gray-400">Lý do từ chối:</span> {item.reject_reason}</div>}
          {item.generated_task_title && (
            <div className="col-span-2">
              <span className="text-gray-400">Công việc khắc phục:</span>{" "}
              <a className="text-blue-600 hover:underline" href={`/work-items/${item.generated_task_id}`}>{item.generated_task_title}</a>
            </div>
          )}
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</div>}

        <div className="flex flex-wrap gap-2 mt-4">
          {isPending && (
            <>
              <button onClick={approve} className="btn btn-primary text-sm">✅ Duyệt</button>
              <button onClick={reject} className="btn btn-secondary text-sm text-red-600">❌ Từ chối</button>
            </>
          )}
          {canGenerateTask && (
            <button onClick={() => setShowGenTask(true)} className="btn btn-primary text-sm">🛠 Tạo công việc khắc phục</button>
          )}
        </div>

        {showGenTask && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg space-y-2">
            <label className="text-xs text-gray-500">Deadline thực hiện (có thể chỉnh lại trước khi phát hành)</label>
            <input type="datetime-local" className="input" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setShowGenTask(false)} className="btn btn-secondary text-sm">Hủy</button>
              <button onClick={generateTask} className="btn btn-primary text-sm">Xác nhận tạo việc</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Lịch sử duyệt</h3>
        {item.history.map((h: any) => (
          <div key={h.id} className="text-sm text-gray-600 flex gap-2">
            <span className="text-xs text-gray-400 w-32 shrink-0">{fmt(h.created_at)}</span>
            <span><b>{h.changed_by_name}</b>: {h.from_status ?? "—"} → {h.to_status}{h.note ? ` (${h.note})` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
