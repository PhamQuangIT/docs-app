import "./globals.css";
import NavBar from "@/components/NavBar";
import FloatingCreateButton from "@/components/FloatingCreateButton";
import AnnouncementGate from "@/components/AnnouncementGate";

export const metadata = {
  title: "Daily Operation Control System",
  description: "Hệ thống quản lý vận hành hàng ngày - 3PL Onsite",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
        <FloatingCreateButton />
        <AnnouncementGate />
      </body>
    </html>
  );
}
