"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const SEVERITY_LABEL: Record<string, { label: string; color: string }> = {
  light: { label: "Nhẹ", color: "#64748b" },
  medium: { label: "Trung bình", color: "#eab308" },
  serious: { label: "Nghiêm trọng", color: "#f97316" },
  critical: { label: "Rất nghiêm trọng / Dừng vận hành", color: "#ef4444" },
};
const STATUS_LABEL: Record<string, string> = {
  pending_team_lead: "Chờ Trưởng nhóm duyệt",
  pending_deputy: "Chờ Phó phòng duyệt",
  pending_department_head: "Chờ Trưởng phòng duyệt",
  pending_director: "Chờ Giám đốc/Trợ lý GĐ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
};

function fmt(dt: string) {
  return new Date(dt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function IncidentReportsPageInner() {
  const [scope, setScope] = useState<"pending_me" | "mine" | "all">("pending_me");
  const [items, setItems] = useState<any[]>([]);
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);

  async function load() {
    const res = await fetch(`/api/incident-reports?scope=${scope}`);
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => { load(); }, [scope]);
  useEffect(() => { if (searchParams.get("new") === "1") setShowCreate(true); }, [searchParams]);
  useEffect(() => { fetch("/api/departments").then((r) => r.json()).then(setDepartments).catch(() => {}); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">⚠️ Báo cáo sự cố</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary text-sm">+ Tạo báo cáo sự cố</button>
      </div>

      <div className="flex gap-2">
        {[
          { key: "pending_me", label: "Chờ tôi duyệt" },
          { key: "mine", label: "Báo cáo của tôi" },
          { key: "all", label: "Tất cả" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setScope(t.key as any)}
            className={`text-sm px-3 py-1.5 rounded-md ${scope === t.key ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-500 hover:bg-slate-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {items.length === 0 && <p className="text-sm text-slate-400 p-6 text-center">Không có báo cáo nào</p>}
        {items.map((i) => (
          <Link key={i.id} href={`/incident-reports/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${SEVERITY_LABEL[i.severity]?.color}22`, color: SEVERITY_LABEL[i.severity]?.color }}>
                  {SEVERITY_LABEL[i.severity]?.label}
                </span>
                <span className="font-semibold text-slate-800 truncate">{i.title}</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {i.creator_name} · {i.department_name ?? "Chưa phân bộ phận"} · {fmt(i.created_at)}
              </div>
            </div>
            <span className="text-xs text-slate-500 shrink-0">{STATUS_LABEL[i.status]}</span>
          </Link>
        ))}
      </div>

      {showCreate && <CreateIncidentModal departments={departments} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateIncidentModal({ departments, onClose, onCreated }: { departments: any[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [rootCause, setRootCause] = useState("");
  const [capa, setCapa] = useState("");
  const [capaDeadline, setCapaDeadline] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) { setError("Vui lòng nhập Tiêu đề và Mô tả hiện trạng"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/incident-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, description, severity,
        root_cause: rootCause || undefined,
        capa: capa || undefined,
        capa_deadline: capaDeadline ? new Date(capaDeadline).toISOString() : undefined,
        department_id: departmentId || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <form onSubmit={submit} className="bg-white rounded-lg shadow-lg w-full flex flex-col my-auto" style={{ maxWidth: 600, maxHeight: "calc(100vh - 32px)" }}>
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Tạo báo cáo sự cố</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="text-xs text-gray-500">Tiêu đề sự cố *</label>
            <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Mô tả hiện trạng *</label>
            <textarea className="input mt-1" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Mức độ sự cố *</label>
            <select className="input mt-1" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="light">Nhẹ</option>
              <option value="medium">Trung bình</option>
              <option value="serious">Nghiêm trọng</option>
              <option value="critical">Rất nghiêm trọng / Dừng vận hành</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Bộ phận</label>
            <select className="input mt-1" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">-- Không chọn --</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Nguyên nhân sự cố (Root cause)</label>
            <textarea className="input mt-1" rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Đối sách khắc phục (CAPA)</label>
            <textarea className="input mt-1" rows={2} value={capa} onChange={(e) => setCapa(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Thời hạn thực hiện đối sách</label>
            <input type="date" className="input mt-1" value={capaDeadline} onChange={(e) => setCapaDeadline(e.target.value)} />
          </div>
        </div>
        <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn btn-secondary">Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Đang gửi..." : "Gửi báo cáo"}</button>
        </div>
      </form>
    </div>
  );
}

export default function IncidentReportsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm">Đang tải...</div>}>
      <IncidentReportsPageInner />
    </Suspense>
  );
}
