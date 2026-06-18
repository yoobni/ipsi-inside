import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminShellTop } from "@/components/admin-shell-top";

/**
 * 어드민 페이지 공용 셸 — 좌측 사이드바 + 상단 바 + 본문.
 * /members/*, /tests/* 등 보호된 어드민 라우트에서 layout으로 감싸 사용.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-muted/30">
        <AdminShellTop />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
