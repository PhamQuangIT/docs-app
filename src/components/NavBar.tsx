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
  { href: "/work-items", label: "Giao việc" },
  { href: "/incident-reports", label: "⚠️ Báo cáo sự cố" },
  { href: "/suggestions", label: "💡 Kiến nghị - Đề xuất" },
  { href: "/meetings", label: "📅 Lịch họp" },
  { href: "/reports", label: "Báo cáo" },
  { href: "/announcements", label: "Bảng tin" },
];

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1]?.[0] ?? "?").toUpperCase();
}

// Nút Tab kiểu "3D nổi khối" (Tactile 3D Button) - active: gradient xanh + chân đế đậm;
// inactive: xám ngọc trai + chân đế xám. Hover nảy lên, bấm chìm xuống (translateY).
function NavTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`shrink-0 whitespace-nowrap text-sm font-semibold px-4 py-2 rounded-lg transition-transform duration-100
        hover:-translate-y-0.5 active:translate-y-0.5
        ${active ? "text-white" : "text-slate-600"}`}
      style={{
        background: active ? "linear-gradient(180deg, #3b82f6, #1d4ed8)" : "#f1f5f9",
        borderBottom: active ? "4px solid #1e40af" : "4px solid #cbd5e1",
      }}
    >
      {label}
    </Link>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);

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
    setDrawerOpen(false); // đóng drawer mobile mỗi khi chuyển trang
  }, [pathname]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) setCreateMenuOpen(false);
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
    window.dispatchEvent(new CustomEvent("docs-app:open-create-modal"));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    router.push(`/work-items?q=${encodeURIComponent(search.trim())}`);
    setDrawerOpen(false);
  }

  const createOptions = [
    { label: "🗂 Tạo công việc mới", action: () => openCreateModal() },
    { label: "⚠️ Tạo báo cáo sự cố", action: () => router.push("/incident-reports?new=1") },
    { label: "💡 Tạo kiến nghị/đề xuất", action: () => router.push("/suggestions?new=1") },
    { label: "📅 Tạo lịch họp", action: () => router.push("/meetings?new=1") },
  ];

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
      {/* ============ Hàng trên: brand + search + quick action + bell + avatar ============ */}
      <div className="max-w-7xl mx-auto px-4 h-[60px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger - chỉ hiện < md (mobile/tablet nhỏ) */}
          <button
            onClick={() => setDrawerOpen((s) => !s)}
            className="md:hidden text-xl text-slate-600 px-1 -ml-1"
            aria-label="Mở menu"
          >
            ☰
          </button>
          <span className="font-bold text-[18px] text-slate-800 shrink-0 whitespace-nowrap">DOCS · Vận hành</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <form onSubmit={submitSearch} className="hidden lg:block">
            <div
              className="flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1.5 w-56"
              style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.12)" }}
            >
              <span className="text-slate-400 text-sm">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm..."
                className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
              />
            </div>
          </form>

          <div className="relative" ref={createMenuRef}>
            <button
              onClick={() => setCreateMenuOpen((s) => !s)}
              className="text-sm font-semibold text-white px-3.5 py-2 rounded-lg whitespace-nowrap flex items-center gap-1
                transition-transform duration-100 hover:-translate-y-0.5 active:translate-y-0.5"
              style={{ background: "linear-gradient(180deg, #3b82f6, #1d4ed8)", borderBottom: "4px solid #1e40af" }}
            >
              + Tạo phát sinh ▾
            </button>
            {createMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1.5 z-30">
                {createOptions.map((o) => (
                  <button
                    key={o.label}
                    onClick={() => { setCreateMenuOpen(false); o.action(); }}
                    className="w-full text-left px-3.5 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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
                  <>
                    <Link href="/users" className="block px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setMenuOpen(false)}>
                      Quản trị hệ thống
                    </Link>
                    <Link href="/admin/settings" className="block px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setMenuOpen(false)}>
                      ⚙️ Cài đặt hệ thống
                    </Link>
                  </>
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

      {/* ============ Hàng dưới: 7 tab dạng nút 3D, 1 hàng ngang, chỉ PC (>= md) ============ */}
      <div className="hidden md:block border-t border-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          {LINKS.map((l) => (
            <NavTab key={l.href} href={l.href} label={l.label} active={!!pathname?.startsWith(l.href)} />
          ))}
        </div>
      </div>

      {/* ============ Mobile Drawer (Hamburger Menu trượt) ============ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
            <div className="px-4 h-[60px] flex items-center justify-between border-b border-gray-100 shrink-0">
              <span className="font-bold text-slate-800">DOCS · Vận hành</span>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400 text-xl">✕</button>
            </div>
            <form onSubmit={submitSearch} className="p-3 border-b border-gray-50 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-2" style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.12)" }}>
                <span className="text-slate-400 text-sm">🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm..."
                  className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
                />
              </div>
            </form>
            <div className="flex-1 overflow-y-auto py-2">
              {LINKS.map((l) => {
                const active = !!pathname?.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`block mx-3 my-1 px-4 py-3 rounded-lg text-sm font-semibold ${active ? "text-white" : "text-slate-700 bg-slate-50"}`}
                    style={active ? { background: "linear-gradient(180deg, #3b82f6, #1d4ed8)", borderBottom: "4px solid #1e40af" } : undefined}
                  >
                    {l.label}
                  </Link>
                );
              })}
              <div className="border-t border-gray-100 my-2 mx-3" />
              {createOptions.map((o) => (
                <button
                  key={o.label}
                  onClick={() => { setDrawerOpen(false); o.action(); }}
                  className="block w-full text-left mx-3 my-1 px-4 py-3 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  {o.label}
                </button>
              ))}
              <div className="border-t border-gray-100 my-2 mx-3" />
              <Link href="/my-task" className="block mx-3 my-1 px-4 py-3 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Việc của tôi</Link>
              <Link href="/notifications" className="block mx-3 my-1 px-4 py-3 rounded-lg text-sm text-slate-700 hover:bg-slate-50">🔔 Thông báo {unread > 0 ? `(${unread})` : ""}</Link>
              <Link href="/change-password" className="block mx-3 my-1 px-4 py-3 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Đổi mật khẩu</Link>
              {me?.email === SUPER_ADMIN_EMAIL && (
                <>
                  <Link href="/users" className="block mx-3 my-1 px-4 py-3 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Quản trị hệ thống</Link>
                  <Link href="/admin/settings" className="block mx-3 my-1 px-4 py-3 rounded-lg text-sm text-slate-700 hover:bg-slate-50">⚙️ Cài đặt hệ thống</Link>
                </>
              )}
              <button onClick={handleLogout} className="block w-full text-left mx-3 my-1 px-4 py-3 rounded-lg text-sm text-red-600 hover:bg-red-50">
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
