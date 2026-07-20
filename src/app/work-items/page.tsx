"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PriorityBadge, StatusBadge, TypeLabel } from "@/components/Badges";
import CreateWorkItemModal from "@/components/CreateWorkItemModal";
import SlaCountdown from "@/components/SlaCountdown";
import DepartmentSelect from "@/components/DepartmentSelect";

const TYPE_TABS = [
  { value: "", label: "Tất cả" },
  { value: "issue", label: "Sự cố" },
  { value: "customer_request", label: "Yêu cầu KH" },
  { value: "task", label: "Công việc" },
  { value: "meeting_action", label: "Action họp" },
  { value: "management_task", label: "Việc BGD" },
];

const STATUS_OPTIONS = ["", "new", "assigned", "doing", "waiting", "completed", "closed", "cancelled"];
const STATUS_LABEL: Record<string, string> = {
  "": "Tất cả trạng thái", new: "Mới", assigned: "Đã giao", doing: "Đang xử lý",
  waiting: "Chờ", completed: "Hoàn thành", closed: "Đã đóng", cancelled: "Đã hủy",
};

const FILTER_STORAGE_KEY = "docs_app_work_items_filters";

function fmt(dt: string) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function loadSavedFilters() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function WorkItemsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm">Đang tải...</div>}>
      <WorkItemsPageInner />
    </Suspense>
  );
}

function WorkItemsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const saved = typeof window !== "undefined" ? loadSavedFilters() : null;

  const [items, setItems] = useState<any[]>([]);
  const [type, setType] = useState(saved?.type ?? "");
  const [status, setStatus] = useState(saved?.status ?? "");
  const [q, setQ] = useState("");
  const [personQ, setPersonQ] = useState("");
  const [departmentId, setDepartmentId] = useState(saved?.departmentId ?? "");
  const [positionId, setPositionId] = useState(saved?.positionId ?? "");
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(searchParams.get("create") === "1");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/departments").then((r) => r.json()).then(setDepartments).catch(() => {});
    fetch("/api/positions").then((r) => r.json()).then(setPositions).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    const sp = new URLSearchParams();
    if (type) sp.set("type", type);
    if (status) sp.set("status", status);
    if (q) sp.set("q", q);
    if (personQ) sp.set("person_q", personQ);
    if (departmentId) sp.set("department_id", departmentId);
    if (positionId) sp.set("position_id", positionId);
    const res = await fetch(`/api/work-items?${sp.toString()}`);
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Ghi nhớ bộ lọc để lần sau quay lại vẫn giữ nguyên
    window.localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({ type, status, departmentId, positionId })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status, departmentId, positionId]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Danh sách công việc / phát sinh</h1>
        <button className="btn btn-primary text-sm" onClick={() => setShowCreate(true)}>+ Tạo việc</button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              type === t.value ? "bg-brand-500 text-white border-brand-500" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
        <input
          className="input max-w-[200px]"
          placeholder="Tìm theo tiêu đề..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="input max-w-[180px]"
          placeholder="Tìm theo tên người..."
          value={personQ}
          onChange={(e) => setPersonQ(e.target.value)}
        />
        <select className="input max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <DepartmentSelect
          departments={departments}
          value={departmentId}
          onChange={setDepartmentId}
          className="input max-w-[180px]"
          allLabel="Tất cả bộ phận/nhóm"
        />
        <select className="input max-w-[190px]" value={positionId} onChange={(e) => setPositionId(e.target.value)}>
          <option value="">Tất cả vị trí</option>
          {positions.filter((p) => p.name !== "Khách hàng").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn btn-secondary text-sm">Lọc</button>
      </form>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-4 py-2">Tiêu đề</th>
              <th className="text-left px-4 py-2">Loại</th>
              <th className="text-left px-4 py-2">Ưu tiên</th>
              <th className="text-left px-4 py-2">Trạng thái</th>
              <th className="text-left px-4 py-2">Người xử lý</th>
              <th className="text-left px-4 py-2">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Đang tải...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Không có công việc nào</td></tr>
            )}
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-t border-gray-50 hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/work-items/${item.id}`)}
              >
                <td className="px-4 py-2.5 font-medium text-gray-800 max-w-sm truncate">
                  {item.is_overdue ? <span className="text-red-500 mr-1">⚠</span> : null}
                  {item.title}
                </td>
                <td className="px-4 py-2.5"><TypeLabel type={item.type} /></td>
                <td className="px-4 py-2.5"><PriorityBadge priority={item.priority} /></td>
                <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2.5 text-gray-500">
                  {item.owner_name ?? (item.owner_name_manual ? `${item.owner_name_manual} (ghi chú)` : "Chưa gán")}
                </td>
                <td className="px-4 py-2.5">
                  <div className="text-gray-500">{fmt(item.deadline)}</div>
                  <SlaCountdown deadline={item.deadline} status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateWorkItemModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}
