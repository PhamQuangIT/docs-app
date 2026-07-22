"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Me {
  id: string;
  email: string;
  fullName: string;
  roleName: string;
}

const SUPER_ADMIN_EMAIL = "admin@3pl.local"; // chỉ dùng để hiện/ẩn mục menu - quyền thật được server kiểm tra lại

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/work-items", label: "Công việc" },
  { href: "/reports", label: "Báo cáo" },
  { href: "/announcements", label: "Bảng tin" },
];

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1]?.[0] ?? "?").toUpperCase();
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function openCreateModal() {
    // FloatingCreateButton lắng nghe sự kiện này để mở đúng 1 modal Tạo việc dùng chung toàn hệ thống
    window.dispatchEvent(new CustomEvent("docs-app:open-create-modal"));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    router.push(`/work-items?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-20" style={{ height: 60 }}>
      <div className="max-w-7xl mx-auto px-4 h-[60px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <span className="font-bold text-[18px] text-slate-800 shrink-0">DOCS · Vận hành</span>
          <nav className="hidden md:flex gap-5">
            {LINKS.map((l) => {
              const active = pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-sm pb-1 border-b-2 transition-colors ${
                    active ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-slate-600 hover:text-slate-800"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <form onSubmit={submitSearch} className="hidden lg:block">
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1.5 w-56">
              <span className="text-slate-400 text-sm">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm..."
                className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
              />
            </div>
          </form>

          <button
            onClick={openCreateModal}
            className="text-sm font-medium text-white px-3.5 py-2 rounded-md hover:opacity-90 transition-opacity whitespace-nowrap"
            style={{ backgroundColor: "#2563eb" }}
          >
            + Tạo việc
          </button>

          <Link href="/notifications" className="relative text-lg text-slate-500 hover:text-slate-700 px-1">
            🔔
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((s) => !s)}
              className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center hover:ring-2 hover:ring-blue-200"
              title={me?.fullName}
            >
              {initials(me?.fullName)}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1.5 z-30">
                <div className="px-3.5 py-2 border-b border-gray-50">
                  <div className="text-sm font-medium text-slate-800 truncate">{me?.fullName}</div>
                  <div className="text-xs text-slate-400 truncate">{me?.roleName}</div>
                </div>
                <Link href="/my-task" className="block px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setMenuOpen(false)}>
                  Việc của tôi
                </Link>
                <Link href="/change-password" className="block px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setMenuOpen(false)}>
                  Đổi mật khẩu
                </Link>
                {me?.email === SUPER_ADMIN_EMAIL && (
                  <Link href="/users" className="block px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setMenuOpen(false)}>
                    Quản trị hệ thống
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-gray-50 mt-1"
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
