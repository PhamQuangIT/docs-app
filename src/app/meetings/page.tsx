"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TYPE_LABEL: Record<string, string> = {
  team: "Họp nhóm", production_direct: "Họp bộ phận sản xuất", production_indirect: "Họp bộ phận gián tiếp",
  department: "Họp phòng", board: "Họp Ban Giám Đốc",
};
function fmt(dt: string) { return new Date(dt).toLocaleString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }

function MeetingsPageInner() {
  const [items, setItems] = useState<any[]>([]);
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  async function load() { const res = await fetch("/api/meetings"); if (res.ok) setItems(await res.json()); }
  useEffect(() => { load(); fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {}); }, []);
  useEffect(() => { if (searchParams.get("new") === "1") setShowCreate(true); }, [searchParams]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">📅 Lịch họp</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary text-sm">+ Tạo lịch họp</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {items.length === 0 && <p className="text-sm text-slate-400 p-6 text-center">Chưa có cuộc họp nào sắp tới</p>}
        {items.map((m) => (
          <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
            <div className="min-w-0">
              <div className="font-semibold text-slate-800 truncate">{m.title}</div>
              <div className="text-xs text-slate-400 mt-0.5">{TYPE_LABEL[m.meeting_type]} · {fmt(m.start_time)} · Host: {m.host_name}</div>
            </div>
            {m.status === "rescheduled" && <span className="text-xs font-semibold text-yellow-600 shrink-0">Đã dời lịch</span>}
          </Link>
        ))}
      </div>
      {showCreate && <CreateMeetingModal users={users} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateMeetingModal({ users, onClose, onCreated }: { users: any[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState("team");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = users.filter((u) => u.full_name.toLowerCase().includes(search.toLowerCase()) || (u.role_name ?? "").toLowerCase().includes(search.toLowerCase()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) { setError("Vui lòng nhập Tiêu đề và Ngày họp"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/meetings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, meeting_type: meetingType,
        start_time: new Date(`${date}T${startTime}`).toISOString(),
        end_time: new Date(`${date}T${endTime}`).toISOString(),
        location: location || undefined, agenda: agenda || undefined, attendee_ids: attendeeIds,
      }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-0 sm:p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <form onSubmit={submit} className="bg-white sm:rounded-lg shadow-lg w-full flex flex-col my-0 sm:my-auto h-full sm:h-auto" style={{ maxWidth: 600, maxHeight: "calc(100vh - 32px)" }}>
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Tạo lịch họp</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="text-xs text-gray-500">Tiêu đề cuộc họp *</label>
            <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Loại / Phạm vi cuộc họp *</label>
            <select className="input mt-1" value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs text-gray-500">Ngày họp *</label><input type="date" className="input mt-1" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Giờ bắt đầu</label><input type="time" className="input mt-1" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Giờ kết thúc</label><input type="time" className="input mt-1" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Địa điểm / Link họp online</label>
            <input className="input mt-1" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Thành phần tham dự * (tìm theo tên/chức danh)</label>
            <input className="input mt-1" placeholder="Gõ để tìm..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="mt-1 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
              {filtered.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={attendeeIds.includes(u.id)} onChange={() => setAttendeeIds((p) => p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id])} />
                  {u.full_name} <span className="text-gray-400 text-xs">({u.role_name})</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Nội dung / Chương trình họp (Agenda)</label>
            <textarea className="input mt-1" rows={3} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
          </div>
        </div>
        <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn btn-secondary">Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Đang tạo..." : "Tạo & Gửi email mời"}</button>
        </div>
      </form>
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm">Đang tải...</div>}>
      <MeetingsPageInner />
    </Suspense>
  );
}
