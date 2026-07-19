"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Me {
  id: string;
  fullName: string;
  roleName: string;
}

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/work-items", label: "Công việc" },
  { href: "/my-task", label: "Việc của tôi" },
  { href: "/announcements", label: "Bảng tin" },
  { href: "/reports", label: "Báo cáo" },
  { href: "/notifications", label: "Thông báo" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (pathname === "/login") return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => setUnread(rows.filter((n) => !n.is_read).length))
      .catch(() => {});
  }, [pathname]);

  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-brand-600">DOCS · Vận hành</span>
          <nav className="flex gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  pathname?.startsWith(l.href)
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {l.label}
                {l.href === "/notifications" && unread > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                    {unread}
                  </span>
                )}
              </Link>
            ))}
            {me?.roleName === "Admin" && (
              <Link
                href="/users"
                className={`px-3 py-1.5 rounded-md text-sm ${
                  pathname?.startsWith("/users") ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Người dùng
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {me && (
            <span className="text-sm text-gray-500">
              {me.fullName} · <span className="text-gray-400">{me.roleName}</span>
            </span>
          )}
          <Link href="/change-password" className="text-xs text-gray-500 hover:text-brand-600 underline">
            Đổi mật khẩu
          </Link>
          <button onClick={handleLogout} className="btn btn-secondary text-xs px-3 py-1.5">
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
