"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PriorityBadge, StatusBadge, TypeLabel } from "@/components/Badges";
import SlaCountdown from "@/components/SlaCountdown";
import EditAssignmentModal from "@/components/EditAssignmentModal";

const SUPER_ADMIN_EMAIL = "admin@3pl.local"; // chỉ để ẩn/hiện nút ở UI - quyền thật do server kiểm tra lại

function fmt(dt: string) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("vi-VN");
}

const PROPOSAL_TYPE_LABEL: Record<string, string> = {
  complete: "Đề nghị hoàn thành",
  cancel: "Đề nghị hủy việc",
  edit: "Đề nghị sửa nội dung/hạn",
  reassign: "Đề nghị giao lại người khác",
};

export default function WorkItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [escalateTo, setEscalateTo] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const [showEscalate, setShowEscalate] = useState(false);
  const [showEditProposal, setShowEditProposal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [showEditAssignment, setShowEditAssignment] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/work-items/${id}`);
    if (res.ok) setItem(await res.json());
  }

  useEffect(() => {
    load();
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/auth/me").then((r) => r.json()).then(setMe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!item) return <div className="text-gray-400 text-sm">Đang tải...</div>;

  const isOwner = me && item.owner_id === me.id;
  const isAssigner = me && (item.assigned_by_id ? item.assigned_by_id === me.id : item.creator_id === me.id);
  const isManager = me && ["BGĐ", "Quản lý"].includes(me.roleName);
  const canActAsAssigner = isAssigner || isManager;
  const canReviewProposal = canActAsAssigner; // cùng logic quyết định đề xuất (mục 7)
  // Quyền CHỈNH SỬA nội dung việc + Điều chỉnh phân công (Prompt 22/07/2026): CHỈ người tạo/người giao việc
  // của ĐÚNG việc này, hoặc Super Admin - KHÔNG áp dụng chung cho mọi Quản lý/BGĐ như các quyền khác ở trên.
  const canEditAssignment =
    !!me && (me.email === SUPER_ADMIN_EMAIL || item.creator_id === me.id || item.assigned_by_id === me.id);
  const pendingProposals = (item.proposals || []).filter((p: any) => p.status === "pending");
  const isFinal = ["completed", "cancelled"].includes(item.status);

  async function doAccept() {
    setBusy(true); setError("");
    const res = await fetch(`/api/work-items/${id}/accept`, { method: "POST" });
    setBusy(false);
    if (res.ok) load(); else setError((await res.json()).error);
  }

  async function doRejectAcceptance() {
    const reason = prompt("Lý do từ chối tiếp nhận (bắt buộc):");
    if (!reason) return;
    setBusy(true); setError("");
    const res = await fetch(`/api/work-items/${id}/reject-acceptance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setBusy(false);
    if (res.ok) load(); else setError((await res.json()).error);
  }

  async function doStatusChange(to: string, needNote?: boolean, needReason?: boolean) {
    let note, reason;
    if (needNote) {
      note = prompt("Ghi chú (bắt buộc):");
      if (!note) return;
    }
    if (needReason) {
      reason = prompt("Lý do (bắt buộc):");
      if (!reason) return;
    }
    setBusy(true); setError("");
    const res = await fetch(`/api/work-items/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to, note, reason }),
    });
    setBusy(false);
    if (res.ok) load();
    else setError((await res.json()).error);
  }

  async function doPropose(type: "complete" | "cancel", needText: string) {
    const note = prompt(`${needText} (bắt buộc):`);
    if (!note) return;
    setError("");
    const res = await fetch(`/api/work-items/${id}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, note }),
    });
    if (res.ok) load();
    else setError((await res.json()).error);
  }

  function openEditProposal() {
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    const d = new Date(item.deadline);
    const tzOffset = d.getTimezoneOffset() * 60000;
    setEditDeadline(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
    setShowEditProposal(true);
  }

  async function submitEditProposal(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const note = prompt("Lý do đề nghị sửa (bắt buộc):");
    if (!note) return;
    const res = await fetch(`/api/work-items/${id}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "edit",
        note,
        proposed_title: editTitle !== item.title ? editTitle : undefined,
        proposed_description: editDescription !== (item.description ?? "") ? editDescription : undefined,
        proposed_deadline: new Date(editDeadline).toISOString() !== item.deadline ? new Date(editDeadline).toISOString() : undefined,
      }),
    });
    if (res.ok) { setShowEditProposal(false); load(); }
    else setError((await res.json()).error);
  }

  async function doComment() {
    if (!comment.trim()) return;
    const res = await fetch(`/api/work-items/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment }),
    });
    if (res.ok) { setComment(""); load(); }
  }

  async function doEscalate() {
    if (!escalateTo || !escalateReason) return;
    const res = await fetch(`/api/work-items/${id}/escalate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ escalated_to: escalateTo, reason: escalateReason }),
    });
    if (res.ok) { setShowEscalate(false); setEscalateReason(""); load(); }
  }

  async function reviewProposal(proposalId: string, action: "approve" | "reject") {
    const review_note = action === "reject" ? prompt("Lý do từ chối (không bắt buộc):") ?? undefined : undefined;
    const res = await fetch(`/api/proposals/${proposalId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_note }),
    });
    if (res.ok) load();
    else setError((await res.json()).error);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Quay lại</button>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TypeLabel type={item.type} />
              {item.is_overdue ? <span className="text-xs text-red-600 font-medium">⚠ QUÁ HẠN</span> : null}
            </div>
            <h1 className="text-lg font-semibold text-gray-800">{item.title}</h1>
          </div>
          <div className="flex gap-2">
            <PriorityBadge priority={item.priority} />
            <StatusBadge status={item.status} />
          </div>
        </div>
        {item.description && <p className="text-sm text-gray-600 mt-2">{item.description}</p>}

        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div><span className="text-gray-400">Người tạo:</span> {item.creator_name}</div>
          <div>
            <span className="text-gray-400">Người chịu trách nhiệm chính:</span> {item.owner_name ?? "Chưa giao"}
            {item.owner_name_manual && (
              <span className="text-gray-400"> (ghi chú lịch sử: {item.owner_name_manual})</span>
            )}
          </div>
          <div><span className="text-gray-400">Người giao việc:</span> {item.assigned_by_name ?? "-"}</div>
          <div>
            <span className="text-gray-400">Người phối hợp:</span>{" "}
            {item.coordinators?.length ? item.coordinators.map((c: any) => c.full_name).join(", ") : "-"}
          </div>
          <div><span className="text-gray-400">Báo cáo cho:</span> {item.report_to_name ?? "-"}</div>
          <div><span className="text-gray-400">Bộ phận:</span> {item.department_name ?? "-"}</div>
          <div><span className="text-gray-400">Vị trí chịu trách nhiệm:</span> {item.position_name ?? "-"}</div>
          <div><span className="text-gray-400">Khách hàng:</span> {item.customer_name ?? "-"}</div>
          <div>
            <span className="text-gray-400">Deadline:</span> {fmt(item.deadline)}{" "}
            <SlaCountdown deadline={item.deadline} status={item.status} />
          </div>
          <div><span className="text-gray-400">Tạo lúc:</span> {fmt(item.created_at)}</div>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</div>}

        <div className="flex flex-wrap gap-2 mt-4">
          {/* Người chịu trách nhiệm chính: Tiếp nhận / Từ chối tiếp nhận (mục 6) */}
          {isOwner && item.status === "pending_acceptance" && (
            <>
              <button onClick={doAccept} disabled={busy} className="btn btn-primary text-sm">✅ Tiếp nhận việc</button>
              <button onClick={doRejectAcceptance} disabled={busy} className="btn btn-secondary text-sm text-red-600">
                ❌ Từ chối tiếp nhận
              </button>
            </>
          )}

          {/* Người chịu trách nhiệm chính: đề xuất khi đang thực hiện (mục 7 - cần người giao việc duyệt) */}
          {isOwner && item.status === "in_progress" && (
            <>
              <button onClick={() => doPropose("complete", "Ghi chú kết quả hoàn thành")} className="btn btn-primary text-sm">
                ✅ Đề nghị hoàn thành
              </button>
              <button onClick={() => doPropose("cancel", "Lý do đề nghị hủy")} className="btn btn-secondary text-sm text-red-600">
                🗑 Đề nghị hủy việc
              </button>
              <button onClick={openEditProposal} className="btn btn-secondary text-sm">
                ✏️ Đề nghị sửa nội dung / hạn
              </button>
            </>
          )}

          {/* Tiếp tục xử lý sau khi bị yêu cầu làm lại: người chịu trách nhiệm hoặc người giao việc */}
          {item.status === "rework_requested" && (isOwner || canEditAssignment) && (
            <button onClick={() => doStatusChange("in_progress")} className="btn btn-primary text-sm">
              ▶️ Tiếp tục xử lý
            </button>
          )}

          {/* Điều chỉnh phân công / Sửa việc: CHỈ người tạo/người giao việc của việc này/Super Admin (siết quyền) */}
          {canEditAssignment && ["draft", "pending_acceptance", "acceptance_rejected", "in_progress"].includes(item.status) && (
            <button onClick={() => setShowEditAssignment(true)} className="btn btn-primary text-sm">
              👤 {item.owner_id ? "Điều chỉnh phân công" : "Giao việc"}
            </button>
          )}
          {/* Các thao tác trực tiếp khác của Người giao việc - từ nay CŨNG siết về canEditAssignment
              (chỉ người tạo/người giao việc của việc này/Super Admin), không còn cho mọi Quản lý/BGĐ */}
          {canEditAssignment && item.status === "in_progress" && (
            <button onClick={() => doStatusChange("rework_requested", false, true)} className="btn btn-secondary text-sm">
              ↩️ Yêu cầu xử lý lại
            </button>
          )}
          {canEditAssignment && ["draft", "pending_acceptance", "in_progress", "rework_requested", "acceptance_rejected"].includes(item.status) && (
            <button onClick={() => doStatusChange("cancelled", false, true)} className="btn btn-secondary text-sm text-red-600">
              🚫 Hủy việc
            </button>
          )}
          {canEditAssignment && item.status === "completed" && (
            <button onClick={() => doStatusChange("in_progress", false, true)} className="btn btn-secondary text-sm">
              ↩️ Mở lại (trong 48h)
            </button>
          )}

          {!isFinal && (
            <button onClick={() => setShowEscalate((s) => !s)} className="btn btn-secondary text-sm text-orange-600">
              🚨 Escalate
            </button>
          )}
        </div>

        {showEditAssignment && (
          <EditAssignmentModal
            item={item}
            onClose={() => setShowEditAssignment(false)}
            onSaved={() => { setShowEditAssignment(false); load(); }}
          />
        )}

        {showEditProposal && (
          <form onSubmit={submitEditProposal} className="mt-3 p-3 bg-blue-50 rounded-lg space-y-2">
            <p className="text-xs text-gray-500">Đề nghị sửa nội dung/hạn - gửi cho người giao việc duyệt trước khi có hiệu lực.</p>
            <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Tiêu đề" />
            <textarea className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Mô tả" rows={2} />
            <input type="datetime-local" className="input" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowEditProposal(false)} className="btn btn-secondary text-sm">Hủy</button>
              <button type="submit" className="btn btn-primary text-sm">Gửi đề nghị</button>
            </div>
          </form>
        )}

        {showEscalate && (
          <div className="mt-3 p-3 bg-orange-50 rounded-lg space-y-2">
            <select className="input" value={escalateTo} onChange={(e) => setEscalateTo(e.target.value)}>
              <option value="">-- Escalate cho ai --</option>
              {users.filter((u) => ["Quản lý", "BGĐ"].includes(u.role_name)).map((u) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.role_name})</option>
              ))}
            </select>
            <textarea
              className="input"
              placeholder="Lý do cần hỗ trợ..."
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
            />
            <button onClick={doEscalate} className="btn btn-primary text-sm">Gửi Escalate</button>
          </div>
        )}
      </div>

      {pendingProposals.length > 0 && (
        <div className="card border-2 border-brand-200">
          <h3 className="text-sm font-semibold text-brand-700 mb-3">📋 Đề xuất đang chờ duyệt</h3>
          <div className="space-y-3">
            {pendingProposals.map((p: any) => (
              <div key={p.id} className="bg-brand-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{PROPOSAL_TYPE_LABEL[p.type]}</span>
                  <span className="text-xs text-gray-400">{fmt(p.created_at)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Người đề xuất: {p.proposed_by_name}</p>
                {p.note && <p className="text-sm text-gray-600 mt-1">Ghi chú: {p.note}</p>}
                {p.type === "edit" && (
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    {p.proposed_title && <div>Tiêu đề mới: {p.proposed_title}</div>}
                    {p.proposed_description && <div>Mô tả mới: {p.proposed_description}</div>}
                    {p.proposed_deadline && <div>Deadline mới: {fmt(p.proposed_deadline)}</div>}
                  </div>
                )}
                {p.type === "reassign" && p.proposed_owner_name && (
                  <div className="text-xs text-gray-500 mt-1">Người được đề xuất giao lại: {p.proposed_owner_name}</div>
                )}
                {canReviewProposal && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => reviewProposal(p.id, "approve")} className="btn btn-primary text-xs px-3 py-1">Duyệt</button>
                    <button onClick={() => reviewProposal(p.id, "reject")} className="btn btn-secondary text-xs px-3 py-1">Từ chối</button>
                  </div>
                )}
                {!canReviewProposal && <p className="text-xs text-gray-400 mt-1">Đang chờ người giao việc duyệt...</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Bình luận</h3>
        <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
          {item.comments.length === 0 && <p className="text-sm text-gray-400">Chưa có bình luận</p>}
          {item.comments.map((c: any) => (
            <div key={c.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-xs text-gray-400 mb-0.5">{c.user_name} · {fmt(c.created_at)}</div>
              {c.content}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input" placeholder="Viết bình luận..." value={comment} onChange={(e) => setComment(e.target.value)} />
          <button onClick={doComment} className="btn btn-secondary text-sm">Gửi</button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Lịch sử xử lý</h3>
        <div className="space-y-2">
          {item.history.map((h: any) => (
            <div key={h.id} className="text-sm flex items-start gap-2">
              <span className="text-gray-400 text-xs w-32 shrink-0">{fmt(h.created_at)}</span>
              <span>
                <b>{h.changed_by_name}</b>: {h.from_status ?? "—"} → {h.to_status}
                {h.note ? <span className="text-gray-500"> ({h.note})</span> : null}
              </span>
            </div>
          ))}
        </div>
        {item.escalations?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <h4 className="text-xs font-semibold text-orange-600 mb-1">Escalation</h4>
            {item.escalations.map((e: any) => (
              <div key={e.id} className="text-sm text-gray-600">
                {e.is_auto ? "[Tự động]" : e.escalated_from_name} → {e.escalated_to_name}: {e.reason}
              </div>
            ))}
          </div>
        )}
        {item.proposals?.filter((p: any) => p.status !== "pending").length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <h4 className="text-xs font-semibold text-gray-500 mb-1">Lịch sử đề xuất</h4>
            {item.proposals.filter((p: any) => p.status !== "pending").map((p: any) => (
              <div key={p.id} className="text-sm text-gray-600">
                {PROPOSAL_TYPE_LABEL[p.type]} bởi {p.proposed_by_name} —{" "}
                <span className={p.status === "approved" ? "text-green-600" : "text-red-500"}>
                  {p.status === "approved" ? "Đã duyệt" : "Đã từ chối"}
                </span>{" "}
                bởi {p.reviewed_by_name} {p.review_note ? `(${p.review_note})` : ""}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
