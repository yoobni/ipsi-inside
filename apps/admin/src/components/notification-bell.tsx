"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import type { NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/notifications-actions";

export function NotificationBell({
  items,
  unreadCount,
}: {
  items: NotificationItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleItemClick = (n: NotificationItem) => {
    if (!n.read_at) {
      startTransition(async () => {
        await markNotificationReadAction(n.id);
      });
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="알림"
        className="hover:bg-muted relative inline-flex size-9 items-center justify-center rounded-md"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold tabular-nums">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="bg-popover absolute right-0 top-full z-50 mt-2 w-[320px] rounded-md border shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <h3 className="text-sm font-bold">알림</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={pending}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                전체 읽음
              </button>
            )}
          </div>

          <ul className="max-h-[440px] overflow-y-auto">
            {items.length === 0 ? (
              <li className="text-muted-foreground px-4 py-12 text-center text-sm">
                알림이 없어요.
              </li>
            ) : (
              items.map((n) => {
                const unread = !n.read_at;
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "border-b last:border-b-0",
                      unread && "bg-primary/5",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className="hover:bg-muted/50 block w-full px-4 py-3 text-left transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        {unread && (
                          <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-sm",
                              unread
                                ? "font-bold"
                                : "text-muted-foreground font-medium",
                            )}
                          >
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">
                              {n.body}
                            </p>
                          )}
                          <p className="text-muted-foreground mt-1 text-[10px]">
                            {fmtRelative(n.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "방금 전";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
