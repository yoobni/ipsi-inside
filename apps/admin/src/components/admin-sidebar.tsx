"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isMenuActive, menuEntries } from "@/components/admin-menu";

/**
 * 좌측 사이드바. layout이 교직원 권한으로 거른 href 목록만 넘긴다(아이콘 같은
 * 함수는 서버→클라이언트 경계를 못 넘으니 여기서 붙인다) —
 * 조교에게는 허용된 메뉴만 보인다(직접 URL은 proxy가 막는다).
 */
export function AdminSidebar({ allowedHrefs }: { allowedHrefs: string[] }) {
  const pathname = usePathname();
  const items = menuEntries(allowedHrefs);

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="border-b px-5 py-4">
        <Link
          href="/"
          aria-label="어드민 홈으로"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <span className="text-base font-semibold">
            입시인사이드<span className="text-primary">.</span>
          </span>
          <span className="text-xs text-muted-foreground">/ 어드민</span>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-4">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isMenuActive(item, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
