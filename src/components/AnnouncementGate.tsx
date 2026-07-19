"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function fmt(dt: string) {
  return new Date(dt).toLocaleString("vi-VN");
}

export default function AnnouncementGate() {
  const pathname = usePathname();
  const [unread, setUnread] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (pathname === "/login") return;
    fetch("/api/announcements")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        setUnread(rows.filter((a) => !a.is_read));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (pathname === "/login" || !loaded || unread.length === 0) return null;

  async function ack(id: string) {
    await fetch(`/api/announcements/${id}/ack`, { method: "POST" });
    setUnread((list) => list.filter((a) => a.id !== id));
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">📌 Bảng tin nội bộ ({unread.length} tin chưa đọc)</h2>
          <p className="text-xs text-gray-400 mt-0.5">Vui lòng đọc và xác nhận từng tin để tiếp tục sử dụng.</p>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {unread.map((a) => (
            <div key={a.id} className="px-5 py-4">
              <h3 className="font-medium text-gray-800">{a.title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{a.created_by_name} · {fmt(a.created_at)}</p>
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{a.content}</p>
              <button onClick={() => ack(a.id)} className="btn btn-primary text-sm mt-3">
                ✓ Đã đọc
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
