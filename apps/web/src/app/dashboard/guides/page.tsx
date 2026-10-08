import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { getMyNotifications, type NotificationItem } from "@/lib/notifications";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNav } from "@/components/dashboard-nav";
import { Wordmark } from "@/components/wordmark";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/** 발행된 학습 가이드 목록 + 내 진도 */
export default async function GuidesPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");
  if (state.kind !== "ok") return null;

  const [notif, { data: guides }, { data: steps }, { data: progress }] = await Promise.all([
    getMyNotifications(supabase, state.userId),
    supabase.from("guides").select("id, title, summary, work_id, works(title, author)").eq("status", "published").order("published_at", { ascending: false }),
    supabase.from("guide_steps").select("guide_id"),
    state.role === "student" ? supabase.from("guide_progress").select("guide_id").eq("student_id", state.userId) : Promise.resolve({ data: [] as { guide_id: string }[] }),
  ]);
  const total = new Map<string, number>();
  (steps ?? []).forEach((s) => total.set(s.guide_id, (total.get(s.guide_id) ?? 0) + 1));
  const done = new Map<string, number>();
  (progress ?? []).forEach((p) => done.set(p.guide_id, (done.get(p.guide_id) ?? 0) + 1));

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <div className="space-y-1">
        <h1 className="font-display text-[34px] leading-tight">학습 가이드</h1>
        <p className="text-muted-foreground text-sm">작품 하나를 처음부터 끝까지, 단계대로 따라가며 공부해요.</p>
      </div>
      {(guides ?? []).length === 0 ? (
        <div className="border-hairline bg-surface rounded-[14px] border p-8 text-center">
          <BookOpenCheck className="text-muted-foreground mx-auto size-8" />
          <p className="text-muted-foreground mt-3 text-sm">아직 올라온 가이드가 없어요.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(guides ?? []).map((g) => {
            const w = Array.isArray(g.works) ? g.works[0] : g.works;
            const t = total.get(g.id) ?? 0, d = Math.min(done.get(g.id) ?? 0, t);
            const pct = t > 0 ? Math.round((d / t) * 100) : 0;
            return (
              <li key={g.id}>
                <Link href={`/dashboard/guides/${g.id}`} className="border-hairline bg-surface hover:border-primary/40 block rounded-[14px] border p-5 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {(w as { title: string; author: string | null } | null)?.title && (
                        <Badge variant="primary">{(w as { title: string }).title}</Badge>
                      )}
                      <p className="mt-1 truncate font-bold">{g.title}</p>
                      {g.summary && <p className="text-muted-foreground truncate text-xs">{g.summary}</p>}
                    </div>
                    <span className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-bold">
                      {d === 0 ? "시작" : d >= t ? "다시 보기" : "이어서"} <ArrowRight className="size-3.5" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-muted-foreground text-[11px] tabular-nums">{d}/{t}단계</span>
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
          <DashboardNav active="guides" />
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
