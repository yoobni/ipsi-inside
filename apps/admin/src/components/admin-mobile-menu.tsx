"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  FileText,
  Megaphone,
  Menu,
  NotebookPen,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: string;
};

const MENU: MenuItem[] = [
  { href: "/members/pending", label: "가입 승인", icon: UserCheck, matchPrefix: "/members/pending" },
  { href: "/members", label: "회원 관리", icon: Users },
  { href: "/passages", label: "지문/문항", icon: BookOpen, matchPrefix: "/passages" },
  { href: "/tests", label: "시험 관리", icon: FileText, matchPrefix: "/tests" },
  { href: "/journals", label: "학습 일지", icon: NotebookPen, matchPrefix: "/journals" },
  { href: "/daily", label: "일일 마킹", icon: CalendarCheck, matchPrefix: "/daily" },
  { href: "/announcements", label: "공지사항", icon: Megaphone, matchPrefix: "/announcements" },
];

/**
 * 모바일 전용 햄버거 메뉴 — md 이상에선 사이드바, md 미만에선 이거.
 */
export function AdminMobileMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴"
        className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md md:hidden"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setOpen(false)}
        >
          <div className="bg-black/50 absolute inset-0" />
          <aside
            className="bg-card relative h-full w-64 max-w-[80vw] border-r shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2"
              >
                <span className="text-base font-semibold">
                  입시인사이드<span className="text-primary">.</span>
                </span>
                <span className="text-muted-foreground text-xs">/ 어드민</span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="hover:bg-muted inline-flex size-8 items-center justify-center rounded-md"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="px-2 py-4">
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
                        onClick={() => setOpen(false)}
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
        </div>
      )}
    </>
  );
}
