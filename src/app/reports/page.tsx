"use client";
import { useEffect, useState } from "react";

const GROUP_OPTIONS = [
  { value: "status", label: "Theo trạng thái" },
  { value: "priority", label: "Theo mức ưu tiên" },
  { value: "employee", label: "Theo nhân viên/người xử lý" },
  { value: "department", label: "Theo phòng ban" },
  { value: "customer", label: "Theo khách hàng" },
];

export default function ReportsPage() {
  const [groupBy, setGroupBy] = useState("status");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/reports/summary?group_by=${groupBy}`);
    if (res.ok) setRows(await res.json());
    else setRows([]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [groupBy]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Báo cáo vận hành</h1>
        <a href="/api/reports/export" className="btn btn-secondary text-sm">⬇ Xuất Excel</a>
      </div>

      <div className="flex gap-1 flex-wrap">
        {GROUP_OPTIONS.map((g) => (
          <button
            key={g.value}
            onClick={() => setGroupBy(g.value)}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              groupBy === g.value ? "bg-brand-500 text-white border-brand-500" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-4 py-2">Nhóm</th>
              <th className="text-right px-4 py-2">Tổng số</th>
              <th className="text-right px-4 py-2">Đã đóng</th>
              <th className="text-right px-4 py-2">Đúng hạn</th>
              <th className="text-right px-4 py-2">Đang quá hạn</th>
              <th className="text-right px-4 py-2">% Đúng hạn</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center px-4 py-6 text-gray-400">Đang tải...</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="text-center px-4 py-6 text-gray-400">Không có dữ liệu</td></tr>
            )}
            {rows.map((r, idx) => {
              const pct = r.closed_count > 0 ? Math.round((r.on_time_count / r.closed_count) * 100) : 0;
              return (
                <tr key={idx} className="border-t border-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.group_label ?? "Chưa phân loại"}</td>
                  <td className="px-4 py-2.5 text-right">{r.total}</td>
                  <td className="px-4 py-2.5 text-right">{r.closed_count}</td>
                  <td className="px-4 py-2.5 text-right">{r.on_time_count}</td>
                  <td className="px-4 py-2.5 text-right text-red-500">{r.overdue_count}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
