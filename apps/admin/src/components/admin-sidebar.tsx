"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCheck, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: string;
};

const MENU: MenuItem[] = [
  {
    href: "/members/pending",
    label: "가입 승인",
    icon: UserCheck,
    matchPrefix: "/members/pending",
  },
  {
    href: "/members",
    label: "회원 관리",
    icon: Users,
    // exact match — 그 외 /members/* 는 별도 메뉴
    matchPrefix: undefined,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-surface md:flex md:flex-col">
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
          {MENU.map((item) => {
            const Icon = item.icon;
            const active = item.matchPrefix
              ? pathname.startsWith(item.matchPrefix)
              : pathname === item.href;
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
