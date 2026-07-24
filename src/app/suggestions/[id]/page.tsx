"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ phản hồi", rejected: "Từ chối", approved: "Chấp thuận / Đồng ý thực hiện",
  partially_approved: "Chấp thuận một phần", need_more_info: "Yêu cầu bổ sung thông tin",
  escalated: "Đã chuyển cấp cao hơn", done: "Đã thực hiện / Đã hoàn thành", noted_for_future: "Ghi nhận để nghiên cứu tương lai",
};
function fmt(dt: string) { return dt ? new Date(dt).toLocaleString("vi-VN") : "-"; }

export default function SuggestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  async function load() {
    const res = await fetch(`/api/suggestions/${id}`);
    if (res.ok) setItem(await res.json());
  }
  useEffect(() => { load(); fetch("/api/auth/me").then((r) => r.json()).then(setMe); fetch("/api/users").then((r) => r.json()).then(setUsers); }, [id]);

  if (!item) return <div className="text-gray-400 text-sm">Đang tải...</div>;

  const isCreator = me && item.creator_id === me.id;
  const isRecipient = me && item.recipient_id === me.id;
  const isLocked = ["approved", "partially_approved", "done"].includes(item.status);
  const canEditDirectly = isCreator && (!isLocked || item.edit_unlocked);
  const canRespond = isRecipient && ["pending", "need_more_info"].includes(item.status);
  const pendingEditReq = (item.editRequests || []).find((r: any) => r.status === "pending");

  async function respond(action: string, extra: Record<string, any> = {}) {
    setError("");
    const res = await fetch(`/api/suggestions/${id}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    if (res.ok) load(); else setError((await res.json()).error);
  }
  function doReject() { const r = prompt("Nguyên nhân từ chối (bắt buộc):"); if (r) respond("reject", { reject_reason: r }); }
  function doPartial() { const n = prompt("Nội dung được chấp thuận:"); if (n) respond("partial_approve", { partial_note: n }); }
  function doNeedInfo() { const n = prompt("Cần bổ sung thông tin gì? (không bắt buộc)") ?? ""; respond("need_more_info", { response_note: n }); }
  function doEscalate() {
    const name = prompt("Nhập ID người nhận cấp cao hơn (chọn từ danh sách bên dưới trang):");
    if (name) respond("escalate", { escalated_to_id: name });
  }

  async function requestEdit() {
    const reason = prompt("Lý do muốn sửa kiến nghị đã duyệt (bắt buộc):");
    if (!reason) return;
    const res = await fetch(`/api/suggestions/${id}/edit-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    if (res.ok) load(); else setError((await res.json()).error);
  }
  async function reviewEditReq(reqId: string, action: "approve" | "reject") {
    const res = await fetch(`/api/suggestions/${id}/edit-request/${reqId}/${action}`, { method: "POST" });
    if (res.ok) load(); else setError((await res.json()).error);
  }

  function startEdit() {
    setForm({ title: item.title, content: item.content, reason: item.reason, desired_deadline: item.desired_deadline?.slice(0, 10) });
    setEditing(true);
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/suggestions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, desired_deadline: new Date(form.desired_deadline).toISOString() }),
    });
    if (res.ok) { setEditing(false); load(); } else setError((await res.json()).error);
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Quay lại</button>
      <div className="card">
        <div className="flex items-start justify-between">
          <h1 className="text-lg font-semibold text-gray-800">{item.title}</h1>
          <span className="text-xs text-slate-500">{STATUS_LABEL[item.status]}</span>
        </div>

        {!editing ? (
          <>
            <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{item.content}</p>
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div><span className="text-gray-400">Người kiến nghị:</span> {item.creator_name}</div>
              <div><span className="text-gray-400">Người nhận:</span> {item.recipient_name}</div>
              <div className="col-span-2"><span className="text-gray-400">Lý do:</span> {item.reason}</div>
              <div><span className="text-gray-400">Thời gian tạo:</span> {fmt(item.created_at)}</div>
              <div><span className="text-gray-400">Mong muốn phản hồi trước:</span> {fmt(item.desired_deadline)}</div>
              {item.reject_reason && <div className="col-span-2 text-red-600"><span className="text-gray-400">Nguyên nhân từ chối:</span> {item.reject_reason}</div>}
              {item.partial_note && <div className="col-span-2"><span className="text-gray-400">Nội dung chấp thuận 1 phần:</span> {item.partial_note}</div>}
              {item.response_note && <div className="col-span-2"><span className="text-gray-400">Ghi chú phản hồi:</span> {item.response_note}</div>}
            </div>
          </>
        ) : (
          <form onSubmit={saveEdit} className="mt-3 space-y-2">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className="input" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            <textarea className="input" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <input type="date" className="input" value={form.desired_deadline} onChange={(e) => setForm({ ...form, desired_deadline: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary text-sm">Hủy</button>
              <button type="submit" className="btn btn-primary text-sm">Lưu</button>
            </div>
          </form>
        )}

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</div>}

        <div className="flex flex-wrap gap-2 mt-4">
          {canEditDirectly && !editing && <button onClick={startEdit} className="btn btn-secondary text-sm">✏️ Sửa</button>}
          {isCreator && isLocked && !item.edit_unlocked && !pendingEditReq && (
            <button onClick={requestEdit} className="btn btn-secondary text-sm">📝 Đề xuất sửa kiến nghị</button>
          )}
          {canRespond && (
            <>
              <button onClick={() => respond("approve")} className="btn btn-primary text-sm">✅ Chấp thuận</button>
              <button onClick={doPartial} className="btn btn-secondary text-sm">🟡 Chấp thuận một phần</button>
              <button onClick={doReject} className="btn btn-secondary text-sm text-red-600">❌ Từ chối</button>
              <button onClick={doNeedInfo} className="btn btn-secondary text-sm">❓ Yêu cầu bổ sung</button>
              <button onClick={doEscalate} className="btn btn-secondary text-sm">⬆️ Chuyển cấp cao hơn</button>
              <button onClick={() => respond("mark_done")} className="btn btn-secondary text-sm">✔️ Đã hoàn thành</button>
              <button onClick={() => respond("note_for_future")} className="btn btn-secondary text-sm">🗂 Ghi nhận tương lai</button>
            </>
          )}
        </div>

        {isRecipient && pendingEditReq && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-slate-700">{pendingEditReq.requested_by_name} xin phép sửa lại: {pendingEditReq.reason}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => reviewEditReq(pendingEditReq.id, "approve")} className="btn btn-primary text-xs px-3 py-1">Đồng ý</button>
              <button onClick={() => reviewEditReq(pendingEditReq.id, "reject")} className="btn btn-secondary text-xs px-3 py-1">Từ chối</button>
            </div>
          </div>
        )}

        {canRespond && (
          <p className="text-xs text-gray-400 mt-2">
            Gợi ý chuyển cấp cao hơn - ID người dùng: {users.filter((u) => u.id !== item.creator_id).map((u) => `${u.full_name}: ${u.id}`).join(" | ")}
          </p>
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
