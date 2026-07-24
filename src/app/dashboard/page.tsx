"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PriorityBadge, TypeLabel } from "@/components/Badges";

function fmt(dt: string) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function overdueDuration(deadline: string) {
  const ms = Date.now() - new Date(deadline).getTime();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h${m.toString().padStart(2, "0")}p`;
}

function TaskRow({ item, variant }: { item: any; variant: "default" | "assigned" }) {
  return (
    <Link
      href={`/work-items/${item.id}`}
      className="flex items-center justify-between gap-3 py-2.5 px-3 border-b border-gray-50 last:border-0 hover:bg-slate-50 rounded-lg"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={item.priority} />
          <span className="text-sm font-semibold text-slate-800 truncate">{item.title}</span>
        </div>
        <div className="text-xs text-slate-400 mt-0.5 truncate">
          {variant === "assigned" ? (
            <>Giao cho: {item.owner_name ?? "Chưa gán"} · Hạn: {fmt(item.deadline)}</>
          ) : (
            <>
              <TypeLabel type={item.type} /> · {item.creator_name ?? "-"}
            </>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {item.is_overdue ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#fee2e2", color: "#ef4444" }}>
            ⚠️ Trễ {overdueDuration(item.deadline)}
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#fef9c3", color: "#a16207" }}>
            ⏳ Đang làm
          </span>
        )}
      </div>
    </Link>
  );
}

const TABS = [
  { key: "overdue", label: "Quá hạn", dot: "#ef4444" },
  { key: "deadlineToday", label: "Deadline hôm nay", dot: "#eab308" },
  { key: "myTask", label: "Việc của tôi", dot: "#2563eb" },
  { key: "assignedByMe", label: "Việc đã giao", dot: "#7c3aed" },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overdue");

  async function load() {
    const res = await fetch("/api/dashboard");
    const json = await res.json();
    setData(json);
    setLastUpdated(new Date());
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000); // tự làm mới mỗi 60 giây
    return () => clearInterval(timer);
  }, []);

  if (!data) return <div className="text-gray-400 text-sm">Đang tải dashboard...</div>;

  const activeList: any[] = data[tab] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard vận hành</h1>
          {lastUpdated && (
            <p className="text-xs text-slate-400 mt-0.5">
              Cập nhật: {lastUpdated.toLocaleTimeString("vi-VN")}{" "}
              <button onClick={load} className="text-blue-600 hover:underline ml-1">🔄 Làm mới</button>
            </p>
          )}
        </div>
      </div>

      {/* KPI cards - grid 4 cột, click để drill-down sang tab tương ứng kèm bộ lọc */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => router.push("/incident-reports?today=1")}
          className="text-left bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="text-xs text-slate-500">Sự cố hôm nay</div>
          <div className="text-2xl font-bold mt-1" style={{ color: "#eab308" }}>{data.todayIssues}</div>
        </button>
        <button
          onClick={() => router.push("/work-items?is_overdue=true")}
          className="text-left bg-white rounded-xl border-2 p-4 cursor-pointer hover:shadow-md transition-shadow"
          style={{ borderColor: "#ef4444" }}
        >
          <div className="text-xs font-medium" style={{ color: "#ef4444" }}>Đang quá hạn</div>
          <div className="text-2xl font-bold mt-1" style={{ color: "#ef4444" }}>{data.overdue.length}</div>
        </button>
        <button
          onClick={() => router.push("/work-items?status=rework_requested")}
          className="text-left bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="text-xs text-slate-500">Cần xử lý lại</div>
          <div className="text-2xl font-bold mt-1 text-slate-700">{data.needSupport.length}</div>
        </button>
        <button
          onClick={() => router.push("/work-items?status=completed&completed_today=1")}
          className="text-left bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="text-xs text-slate-500">Hoàn thành hôm nay</div>
          <div className="text-2xl font-bold mt-1" style={{ color: "#22c55e" }}>{data.completedToday}</div>
        </button>
      </div>

      {/* Layout 2 cột: 65% - 35% */}
      <div className="grid grid-cols-1 md:grid-cols-[65%_35%] gap-4">
        {/* Cột trái: danh sách gộp tab */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex flex-wrap gap-1 border-b border-gray-100 pb-2 mb-1">
            {TABS.map((t) => {
              const count = (data[t.key] ?? []).length;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors ${
                    active ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.dot }} />
                  {t.label} ({count})
                </button>
              );
            })}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {activeList.length === 0 && (
              <p className="text-sm text-slate-400 py-6 text-center">Không có công việc nào ở mục này 🎉</p>
            )}
            {activeList.map((i) => (
              <TaskRow key={i.id} item={i} variant={tab === "assignedByMe" ? "assigned" : "default"} />
            ))}
          </div>
          {activeList.length > 0 && (
            <div className="text-center pt-2">
              <Link href="/work-items" className="text-sm text-blue-600 hover:underline">
                Xem tất cả {activeList.length} công việc →
              </Link>
            </div>
          )}
        </div>

        {/* Cột phải: widget phụ */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Yêu cầu KH đang mở ({data.customerRequests.length})
            </h3>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {data.customerRequests.length === 0 && <p className="text-xs text-slate-400">Không có yêu cầu nào đang mở</p>}
              {data.customerRequests.map((i: any) => (
                <Link key={i.id} href={`/work-items/${i.id}`} className="block bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-2">
                  <div className="text-sm font-medium text-slate-800 truncate">{i.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {i.is_overdue ? <span style={{ color: "#ef4444" }}>Quá {overdueDuration(i.deadline)}</span> : fmt(i.deadline)}
                    {" · "}{i.owner_name ? `Đã gán: ${i.owner_name}` : "Chưa gán"}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Hiệu suất phòng ban</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 text-xs">
                  <th className="pb-2 font-medium">PHÒNG BAN</th>
                  <th className="pb-2 font-medium text-right">TỔNG</th>
                  <th className="pb-2 font-medium text-right">% ĐÚNG HẠN</th>
                </tr>
              </thead>
              <tbody>
                {data.deptPerformance.map((d: any, idx: number) => {
                  const pct = d.closed_count > 0 ? Math.round((d.on_time / d.closed_count) * 100) : 0;
                  const pctColor = pct === 0 ? "#ef4444" : pct >= 100 ? "#22c55e" : "#eab308";
                  return (
                    <tr key={idx} className="border-t border-gray-50">
                      <td className="py-1.5 text-slate-700">{d.department_name ?? "Chưa phân loại"}</td>
                      <td className="py-1.5 text-right text-slate-700">{d.total}</td>
                      <td className="py-1.5 text-right font-semibold" style={{ color: pctColor }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
