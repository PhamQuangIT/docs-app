"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PriorityBadge, StatusBadge, TypeLabel } from "@/components/Badges";

function fmt(dt: string) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function MyTaskPage() {
  const [items, setItems] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((u) => {
      setMe(u);
      fetch(`/api/work-items?mine=true`).then((r) => r.json()).then(setItems);
    });
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Việc của tôi</h1>
      <p className="text-xs text-gray-400">
        Bao gồm việc được gán trực tiếp cho bạn, và việc gán theo đúng Vị trí chịu trách nhiệm của bạn
        {me?.positionId ? "" : " (bạn chưa có Vị trí trong hồ sơ, chỉ hiện việc gán trực tiếp)"}.
      </p>
      <div className="card p-0 overflow-hidden">
        {items.length === 0 && <p className="text-sm text-gray-400 p-4">Bạn không có việc nào được giao</p>}
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/work-items/${item.id}`}
            className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50"
          >
            <div>
              <div className="font-medium text-gray-800">
                {item.is_overdue ? <span className="text-red-500 mr-1">⚠</span> : null}
                {item.title}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <TypeLabel type={item.type} />
                <StatusBadge status={item.status} />
                {item.owner_id !== me?.id && item.position_name && (
                  <span className="text-xs text-purple-500">theo vị trí: {item.position_name}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={item.priority} />
              <span className="text-xs text-gray-400">{fmt(item.deadline)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
