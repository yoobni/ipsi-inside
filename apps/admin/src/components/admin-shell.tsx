import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminShellTop } from "@/components/admin-shell-top";

/**
 * 어드민 페이지 공용 셸 — 좌측 사이드바 + 상단 바 + 본문.
 * 메뉴는 layout이 교직원 권한으로 거른 href 목록으로 준다.
 */
export function AdminShell({
  children,
  allowedHrefs,
  staffLabel,
}: {
  children: ReactNode;
  allowedHrefs: string[];
  /** 상단 바에 보여줄 "이름 · 원장/조교" */
  staffLabel: string;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar allowedHrefs={allowedHrefs} />
      <div className="flex min-w-0 flex-1 flex-col bg-muted/30">
        <AdminShellTop allowedHrefs={allowedHrefs} staffLabel={staffLabel} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
