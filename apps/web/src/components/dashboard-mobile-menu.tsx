"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, UserIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

/**
 * lg 미만 전용 햄버거 메뉴. 상단 가로 메뉴는 항목이 11개라 태블릿 폭부터
 * 넘치고, 예전엔 md 미만에서 통째로 숨겨져 폰에서는 다른 화면으로 갈 길이
 * 없었다. 항목은 DashboardNav가 넘겨 한 곳에서 관리한다.
 */
export function DashboardMobileMenu({
  items,
  active,
}: {
  items: readonly { key: string; href: string; label: string }[];
  active?: string;
}) {
  const [open, setOpen] = useState(false);

  // 열려 있는 동안 뒤 페이지가 스크롤되지 않게, Esc로 닫히게
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        aria-expanded={open}
        className="hover:bg-muted -order-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {/* 헤더의 backdrop-blur가 fixed 자식의 기준 박스가 되므로 body로 띄운다 */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="메뉴"
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 bg-black/50" />
            <aside
              className="bg-background relative flex h-full w-64 max-w-[80vw] flex-col border-r shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-hairline flex items-center justify-between border-b px-5 py-4">
                <span className="font-display text-xl tracking-tight">
                  입시인사이드<span className="text-primary">.</span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                  className="hover:bg-muted inline-flex size-8 items-center justify-center rounded-md"
                >
                  <X className="size-4" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-2 py-3">
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const isActive = item.key === active;
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex items-center rounded-md px-3 py-2.5 text-sm transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="border-hairline space-y-2 border-t p-3">
                <Link
                  href="/dashboard/profile"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2.5 text-sm"
                >
                  <UserIcon className="size-4" />내 정보
                </Link>
                <LogoutButton />
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
