"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PriorityBadge, StatusBadge, TypeLabel } from "@/components/Badges";
import SlaCountdown from "@/components/SlaCountdown";

function fmt(dt: string) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function WorkItemRow({ item }: { item: any }) {
  return (
    <Link
      href={`/work-items/${item.id}`}
      className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{item.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <TypeLabel type={item.type} />
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-400">{item.owner_name || "Chưa gán"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <PriorityBadge priority={item.priority} />
        <div className="text-right">
          <div className="text-xs text-gray-400">{fmt(item.deadline)}</div>
          <SlaCountdown deadline={item.deadline} status={item.status} />
        </div>
      </div>
    </Link>
  );
}

function Widget({ title, count, children, accent }: { title: string; count?: number; children: React.ReactNode; accent?: string }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {count !== undefined && (
          <span className={`text-lg font-bold ${accent ?? "text-brand-600"}`}>{count}</span>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Dashboard vận hành hôm nay</h1>
          {lastUpdated && (
            <p className="text-xs text-gray-400">
              Tự động cập nhật mỗi phút · Lần cuối: {lastUpdated.toLocaleTimeString("vi-VN")}
            </p>
          )}
        </div>
        <Link href="/work-items?create=1" className="btn btn-primary text-sm">+ Tạo việc</Link>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold text-brand-600">{data.todayIssues}</div>
          <div className="text-xs text-gray-500 mt-1">Sự cố hôm nay</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-red-600">{data.overdue.length}</div>
          <div className="text-xs text-gray-500 mt-1">Đang quá hạn</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-purple-600">{data.needSupport.length}</div>
          <div className="text-xs text-gray-500 mt-1">Cần hỗ trợ</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{data.completedToday}</div>
          <div className="text-xs text-gray-500 mt-1">Hoàn thành hôm nay</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Widget title="Quá hạn (Overdue)" count={data.overdue.length} accent="text-red-600">
          {data.overdue.length === 0 && <p className="text-sm text-gray-400">Không có việc quá hạn 🎉</p>}
          {data.overdue.map((i: any) => <WorkItemRow key={i.id} item={i} />)}
        </Widget>

        <Widget title="Cần hỗ trợ (Waiting)" count={data.needSupport.length} accent="text-purple-600">
          {data.needSupport.length === 0 && <p className="text-sm text-gray-400">Không có việc đang chờ</p>}
          {data.needSupport.map((i: any) => <WorkItemRow key={i.id} item={i} />)}
        </Widget>

        <Widget title="Deadline hôm nay" count={data.deadlineToday.length}>
          {data.deadlineToday.length === 0 && <p className="text-sm text-gray-400">Không có deadline hôm nay</p>}
          {data.deadlineToday.map((i: any) => <WorkItemRow key={i.id} item={i} />)}
        </Widget>

        <Widget title="Yêu cầu khách hàng đang mở" count={data.customerRequests.length}>
          {data.customerRequests.length === 0 && <p className="text-sm text-gray-400">Không có yêu cầu nào đang mở</p>}
          {data.customerRequests.map((i: any) => <WorkItemRow key={i.id} item={i} />)}
        </Widget>

        <Widget title="Việc của tôi" count={data.myTask.length}>
          {data.myTask.length === 0 && <p className="text-sm text-gray-400">Bạn không có việc nào đang mở</p>}
          {data.myTask.map((i: any) => <WorkItemRow key={i.id} item={i} />)}
        </Widget>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Hiệu suất theo phòng ban</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs">
                <th className="pb-2">Phòng ban</th>
                <th className="pb-2 text-right">Tổng</th>
                <th className="pb-2 text-right">Đã đóng</th>
                <th className="pb-2 text-right">% Đúng hạn</th>
              </tr>
            </thead>
            <tbody>
              {data.deptPerformance.map((d: any, idx: number) => {
                const pct = d.closed_count > 0 ? Math.round((d.on_time / d.closed_count) * 100) : 0;
                return (
                  <tr key={idx} className="border-t border-gray-50">
                    <td className="py-1.5">{d.department_name ?? "Chưa phân loại"}</td>
                    <td className="py-1.5 text-right">{d.total}</td>
                    <td className="py-1.5 text-right">{d.closed_count}</td>
                    <td className="py-1.5 text-right font-medium">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
