"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TYPE_ICON: Record<string, string> = {
  created: "🆕",
  assigned: "📌",
  comment: "💬",
  deadline_near: "⏰",
  overdue: "⚠️",
  status_change: "🔄",
  escalation: "🚨",
};

function fmt(dt: string) {
  return new Date(dt).toLocaleString("vi-VN");
}

export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const router = useRouter();

  async function load() {
    const res = await fetch("/api/notifications");
    setItems(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleClick(n: any) {
    if (!n.is_read) await fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" });
    if (n.work_item_id) router.push(`/work-items/${n.work_item_id}`);
    load();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    load();
  }

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Thông báo</h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn btn-secondary text-sm">
            ✓ Đánh dấu tất cả đã đọc ({unreadCount})
          </button>
        )}
      </div>
      <div className="card p-0 overflow-hidden">
        {items.length === 0 && <p className="text-sm text-gray-400 p-4">Không có thông báo</p>}
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => handleClick(n)}
            className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 ${
              !n.is_read ? "bg-brand-50/40" : ""
            }`}
          >
            <span>{TYPE_ICON[n.type] ?? "🔔"}</span>
            <div className="flex-1">
              <div className={`text-sm ${!n.is_read ? "font-medium text-gray-800" : "text-gray-600"}`}>{n.message}</div>
              <div className="text-xs text-gray-400 mt-0.5">{fmt(n.created_at)}</div>
            </div>
            {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5" />}
          </button>
        ))}
      </div>
    </div>
  );
}
