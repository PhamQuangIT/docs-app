"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import CreateWorkItemModal from "./CreateWorkItemModal";

export default function FloatingCreateButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Nút "+ Tạo việc" trên NavBar bắn sự kiện này để mở đúng modal dùng chung này (tránh 2 modal khác nhau)
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("docs-app:open-create-modal", onOpen);
    return () => window.removeEventListener("docs-app:open-create-modal", onOpen);
  }, []);

  if (pathname === "/login") return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Tạo phát sinh mới"
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-brand-500 text-white text-2xl
                   shadow-lg hover:bg-brand-600 flex items-center justify-center transition-transform hover:scale-105"
      >
        +
      </button>
      {open && (
        <CreateWorkItemModal
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            // Nếu đang ở trang danh sách thì tải lại; nếu không, điều hướng tới đó
            if (pathname === "/work-items") {
              router.refresh();
              window.location.reload();
            } else {
              router.push("/work-items");
            }
          }}
        />
      )}
    </>
  );
}
