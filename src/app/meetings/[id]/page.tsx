"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const TYPE_LABEL: Record<string, string> = {
  team: "Họp nhóm", production_direct: "Họp bộ phận sản xuất", production_indirect: "Họp bộ phận gián tiếp",
  department: "Họp phòng", board: "Họp Ban Giám Đốc",
};
function fmt(dt: string) { return dt ? new Date(dt).toLocaleString("vi-VN") : "-"; }

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  async function load() { const res = await fetch(`/api/meetings/${id}`); if (res.ok) setItem(await res.json()); }
  useEffect(() => { load(); fetch("/api/auth/me").then((r) => r.json()).then(setMe); }, [id]);

  if (!item) return <div className="text-gray-400 text-sm">Đang tải...</div>;
  const isHost = me && item.host_id === me.id;

  async function cancelMeeting() {
    const reason = prompt("Lý do hủy họp (bắt buộc):");
    if (!reason) return;
    setError("");
    const res = await fetch(`/api/meetings/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    if (res.ok) load(); else setError((await res.json()).error);
  }
  async function reschedule(e: React.FormEvent) {
    e.preventDefault();
    const reason = prompt("Lý do dời lịch (bắt buộc):");
    if (!reason) return;
    setError("");
    const res = await fetch(`/api/meetings/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_time: new Date(`${newDate}T${newStart}`).toISOString(), end_time: new Date(`${newDate}T${newEnd}`).toISOString(), reason }),
    });
    if (res.ok) { setShowReschedule(false); load(); } else setError((await res.json()).error);
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Quay lại</button>
      <div className="card">
        <div className="flex items-start justify-between">
          <h1 className="text-lg font-semibold text-gray-800">{item.title}</h1>
          {item.status === "cancelled" && <span className="text-xs font-semibold text-red-600">Đã hủy</span>}
          {item.status === "rescheduled" && <span className="text-xs font-semibold text-yellow-600">Đã dời lịch</span>}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
          <div><span className="text-gray-400">Loại họp:</span> {TYPE_LABEL[item.meeting_type]}</div>
          <div><span className="text-gray-400">Người tổ chức:</span> {item.host_name}</div>
          <div><span className="text-gray-400">Thời gian:</span> {fmt(item.start_time)} - {fmt(item.end_time)}</div>
          <div><span className="text-gray-400">Địa điểm:</span> {item.location ?? "-"}</div>
          <div className="col-span-2"><span className="text-gray-400">Thành phần:</span> {item.attendees.map((a: any) => a.full_name).join(", ")}</div>
          {item.agenda && <div className="col-span-2 whitespace-pre-wrap"><span className="text-gray-400">Agenda:</span> {item.agenda}</div>}
          {item.cancel_reason && <div className="col-span-2 text-red-600"><span className="text-gray-400">Lý do hủy:</span> {item.cancel_reason}</div>}
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</div>}

        {isHost && item.status !== "cancelled" && (
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowReschedule((s) => !s)} className="btn btn-secondary text-sm">🔄 Dời thời gian họp</button>
            <button onClick={cancelMeeting} className="btn btn-secondary text-sm text-red-600">❌ Hủy cuộc họp</button>
          </div>
        )}

        {showReschedule && (
          <form onSubmit={reschedule} className="mt-3 p-3 bg-blue-50 rounded-lg grid grid-cols-3 gap-2">
            <input type="date" className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
            <input type="time" className="input" value={newStart} onChange={(e) => setNewStart(e.target.value)} required />
            <input type="time" className="input" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} required />
            <div className="col-span-3 flex gap-2">
              <button type="button" onClick={() => setShowReschedule(false)} className="btn btn-secondary text-sm">Hủy</button>
              <button type="submit" className="btn btn-primary text-sm">Xác nhận dời lịch & gửi email</button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Lịch sử</h3>
        {item.history.map((h: any) => (
          <div key={h.id} className="text-sm text-gray-600 flex gap-2">
            <span className="text-xs text-gray-400 w-32 shrink-0">{fmt(h.created_at)}</span>
            <span><b>{h.actor_name}</b>: {h.action}{h.note ? ` (${h.note})` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
