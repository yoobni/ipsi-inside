"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string | null;
  published_at: string | null;
};

export function AnnouncementBanner({ items }: { items: AnnouncementItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (items.length === 0) return null;

  return (
    <section className="border-primary/30 bg-primary/5 rounded-[14px] border">
      <div className="flex items-center gap-2 border-b border-primary/20 px-4 py-2.5">
        <Megaphone className="text-primary size-4" />
        <h2 className="text-foreground text-xs font-bold">
          공지사항 ({items.length})
        </h2>
      </div>
      <ul className="divide-y divide-primary/10">
        {items.map((a) => {
          const isOpen = openId === a.id;
          const hasBody = !!a.body && a.body.trim().length > 0;
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() =>
                  hasBody ? setOpenId(isOpen ? null : a.id) : undefined
                }
                className={cn(
                  "flex w-full items-start gap-2 px-4 py-3 text-left",
                  hasBody && "hover:bg-primary/5",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-semibold">
                    {a.title}
                  </p>
                  {a.published_at && (
                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                      {fmtDate(a.published_at)}
                    </p>
                  )}
                  {hasBody && isOpen && (
                    <p className="text-foreground mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {a.body}
                    </p>
                  )}
                </div>
                {hasBody && (
                  <span className="text-muted-foreground mt-0.5">
                    {isOpen ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
