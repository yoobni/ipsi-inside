import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Puzzle } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { DRILL_KIND_LABEL, PASSAGE_SOURCE_LABEL, type DrillKind, type PassageSource } from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import { getMyNotifications, type NotificationItem } from "@/lib/notifications";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNav } from "@/components/dashboard-nav";
import { Wordmark } from "@/components/wordmark";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/** 발행된 훈련 목록 + 내 최근 결과(첫 시도 정답 수). 학부모는 열람만. */
export default async function DrillsPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");
  if (state.kind !== "ok") return null;

  const [notif, { data: drills }, { data: attempts }] = await Promise.all([
    getMyNotifications(supabase, state.userId),
    supabase
      .from("drills")
      .select("id, title, description, kind, area, time_limit_sec, works(title)")
      .eq("is_published", true)
      .order("published_at", { ascending: false }),
    state.role === "student"
      ? supabase
          .from("drill_attempts")
          .select("drill_id, correct, total, finished_at")
          .eq("student_id", state.userId)
          .not("finished_at", "is", null)
          .order("finished_at", { ascending: false })
      : Promise.resolve({ data: [] as { drill_id: string; correct: number | null; total: number | null; finished_at: string | null }[] }),
  ]);
  const best = new Map<string, { correct: number; total: number; n: number }>();
  (attempts ?? []).forEach((a) => {
    const cur = best.get(a.drill_id);
    const c = a.correct ?? 0, t = a.total ?? 0;
    if (!cur) best.set(a.drill_id, { correct: c, total: t, n: 1 });
    else {
      cur.n += 1;
      if (t > 0 && c / t > (cur.total > 0 ? cur.correct / cur.total : 0)) { cur.correct = c; cur.total = t; }
    }
  });

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <div className="space-y-1">
        <h1 className="font-display text-[34px] leading-tight">훈련</h1>
        <p className="text-muted-foreground text-sm">
          5~10문항 짧은 반복 훈련이에요. 틀린 건 바로 다시 나와요 — 전부 맞힐 때까지.
        </p>
      </div>

      {(drills ?? []).length === 0 ? (
        <div className="border-hairline bg-surface rounded-[14px] border p-8 text-center">
          <Puzzle className="text-muted-foreground mx-auto size-8" />
          <p className="text-muted-foreground mt-3 text-sm">아직 올라온 훈련이 없어요.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(drills ?? []).map((d) => {
            const w = Array.isArray(d.works) ? d.works[0] : d.works;
            const b = best.get(d.id);
            return (
              <li key={d.id}>
                <Link
                  href={`/dashboard/drills/${d.id}`}
                  className="border-hairline bg-surface hover:border-primary/40 flex items-center justify-between gap-3 rounded-[14px] border p-5 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Puzzle className="text-primary size-5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="primary">{DRILL_KIND_LABEL[d.kind as DrillKind]}</Badge>
                        {d.area && <Badge variant="outline">{PASSAGE_SOURCE_LABEL[d.area as PassageSource]}</Badge>}
                        {(w as { title: string } | null)?.title && <Badge variant="outline">{(w as { title: string }).title}</Badge>}
                        {d.time_limit_sec && <Badge variant="outline">⏱ {d.time_limit_sec}초</Badge>}
                      </div>
                      <p className="mt-1 truncate font-bold">{d.title}</p>
                      {d.description && <p className="text-muted-foreground truncate text-xs">{d.description}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {b ? (
                      <>
                        <p className="text-sm font-bold tabular-nums">{b.correct}/{b.total}</p>
                        <p className="text-muted-foreground text-[11px]">최고 · {b.n}회</p>
                      </>
                    ) : (
                      <span className="text-primary inline-flex items-center gap-1 text-xs font-bold">
                        시작 <ArrowRight className="size-3.5" />
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

function Shell({ children, notifItems, unreadCount }: { children: React.ReactNode; notifItems: NotificationItem[]; unreadCount: number }) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <Wordmark size="md" />
          <DashboardNav active="drills" />
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell items={notifItems} unreadCount={unreadCount} />
          <ThemeToggle />
          <div className="hidden md:block"><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-8">{children}</main>
    </div>
  );
}
