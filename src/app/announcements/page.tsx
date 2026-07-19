"use client";
import { useEffect, useState } from "react";

function fmt(dt: string) {
  return new Date(dt).toLocaleString("vi-VN");
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/announcements");
    setItems(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Vui lòng nhập đầy đủ tiêu đề và nội dung");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    setLoading(false);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setTitle("");
    setContent("");
    setShowForm(false);
    load();
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Bảng tin nội bộ</h1>
        <button className="btn btn-primary text-sm" onClick={() => setShowForm((s) => !s)}>
          + Đăng tin mới
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Ai cũng có thể đăng tin. Mọi người mở phần mềm sẽ phải xác nhận "Đã đọc" cho từng tin mới.
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-3">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="text-xs text-gray-500">Tiêu đề</label>
            <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Nội dung</label>
            <textarea className="input mt-1" rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Đang đăng..." : "Đăng tin"}
          </button>
        </form>
      )}

      <div className="card p-0 overflow-hidden divide-y divide-gray-50">
        {items.length === 0 && <p className="text-sm text-gray-400 p-4">Chưa có bảng tin nào</p>}
        {items.map((a) => (
          <div key={a.id} className="p-4">
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-gray-800">{a.title}</h3>
              {!a.is_read && <span className="badge status-waiting shrink-0">Chưa đọc</span>}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{a.created_by_name} · {fmt(a.created_at)}</p>
            <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{a.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
