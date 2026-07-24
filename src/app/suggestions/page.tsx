"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ phản hồi", color: "#3730a3" },
  rejected: { label: "Từ chối", color: "#ef4444" },
  approved: { label: "Chấp thuận", color: "#22c55e" },
  partially_approved: { label: "Chấp thuận một phần", color: "#eab308" },
  need_more_info: { label: "Yêu cầu bổ sung", color: "#f97316" },
  escalated: { label: "Đã chuyển cấp cao hơn", color: "#7c3aed" },
  done: { label: "Đã hoàn thành", color: "#16a34a" },
  noted_for_future: { label: "Ghi nhận tương lai", color: "#64748b" },
};
function fmt(dt: string) { return new Date(dt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }

function SuggestionsPageInner() {
  const [scope, setScope] = useState<"pending_me" | "mine" | "all">("pending_me");
  const [items, setItems] = useState<any[]>([]);
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  async function load() {
    const res = await fetch(`/api/suggestions?scope=${scope}`);
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => { load(); }, [scope]);
  useEffect(() => { if (searchParams.get("new") === "1") setShowCreate(true); }, [searchParams]);
  useEffect(() => { fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {}); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">💡 Kiến nghị - Đề xuất</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary text-sm">+ Tạo kiến nghị/đề xuất</button>
      </div>
      <div className="flex gap-2">
        {[{ key: "pending_me", label: "Chờ tôi phản hồi" }, { key: "mine", label: "Kiến nghị của tôi" }, { key: "all", label: "Tất cả" }].map((t) => (
          <button key={t.key} onClick={() => setScope(t.key as any)} className={`text-sm px-3 py-1.5 rounded-md ${scope === t.key ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-500 hover:bg-slate-50"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {items.length === 0 && <p className="text-sm text-slate-400 p-6 text-center">Không có kiến nghị nào</p>}
        {items.map((i) => (
          <Link key={i.id} href={`/suggestions/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
            <div className="min-w-0">
              <div className="font-semibold text-slate-800 truncate">{i.title}</div>
              <div className="text-xs text-slate-400 mt-0.5">Từ {i.creator_name} → {i.recipient_name} · {fmt(i.created_at)}</div>
            </div>
            <span className="text-xs font-semibold shrink-0" style={{ color: STATUS_LABEL[i.status]?.color }}>{STATUS_LABEL[i.status]?.label}</span>
          </Link>
        ))}
      </div>
      {showCreate && <CreateSuggestionModal users={users} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateSuggestionModal({ users, onClose, onCreated }: { users: any[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [reason, setReason] = useState("");
  const [deadline, setDeadline] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !reason.trim() || !deadline || !recipientId) {
      setError("Vui lòng nhập đầy đủ các trường bắt buộc"); return;
    }
    setSaving(true); setError("");
    const res = await fetch("/api/suggestions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, reason, desired_deadline: new Date(deadline).toISOString(), recipient_id: recipientId }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <form onSubmit={submit} className="bg-white rounded-lg shadow-lg w-full flex flex-col my-auto" style={{ maxWidth: 560, maxHeight: "calc(100vh - 32px)" }}>
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Tạo kiến nghị / đề xuất</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="text-xs text-gray-500">Tiêu đề kiến nghị *</label>
            <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Nội dung kiến nghị chi tiết *</label>
            <textarea className="input mt-1" rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Lý do kiến nghị *</label>
            <textarea className="input mt-1" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Thời hạn mong muốn có phản hồi *</label>
            <input type="date" className="input mt-1" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Người/cấp tiếp nhận * (có thể chọn vượt cấp)</label>
            <select className="input mt-1" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
              <option value="">-- Chọn người nhận --</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role_name})</option>)}
            </select>
          </div>
        </div>
        <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn btn-secondary">Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Đang gửi..." : "Gửi kiến nghị"}</button>
        </div>
      </form>
    </div>
  );
}

export default function SuggestionsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm">Đang tải...</div>}>
      <SuggestionsPageInner />
    </Suspense>
  );
}
