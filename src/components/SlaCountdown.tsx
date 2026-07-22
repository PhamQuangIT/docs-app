"use client";
import { useEffect, useState } from "react";

function formatCountdown(deadline: string, status: string): { text: string; className: string } {
  if (["completed", "cancelled"].includes(status)) {
    return { text: "", className: "" };
  }
  const diffMs = new Date(deadline).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const absMin = Math.abs(diffMin);
  const hours = Math.floor(absMin / 60);
  const mins = absMin % 60;
  const label = hours > 0 ? `${hours} giờ ${mins > 0 ? mins + " phút" : ""}`.trim() : `${mins} phút`;

  if (diffMin < 0) {
    return { text: `Quá hạn ${label}`, className: "text-red-600 font-semibold" };
  }
  if (diffMin <= 60) {
    return { text: `Còn ${label}`, className: "text-red-500 font-medium" };
  }
  if (diffMin <= 240) {
    return { text: `Còn ${label}`, className: "text-orange-500 font-medium" };
  }
  return { text: `Còn ${label}`, className: "text-gray-500" };
}

export default function SlaCountdown({ deadline, status }: { deadline: string; status: string }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000); // cập nhật mỗi phút
    return () => clearInterval(timer);
  }, []);

  const { text, className } = formatCountdown(deadline, status);
  if (!text) return null;

  return <span className={`text-xs ${className}`}>{text}</span>;
}
