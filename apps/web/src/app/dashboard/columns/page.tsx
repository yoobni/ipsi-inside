import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Check } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { getMyNotifications, type NotificationItem } from "@/lib/notifications";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNav } from "@/components/dashboard-nav";
import { Wordmark } from "@/components/wordmark";

export const dynamic = "force-dynamic";

export default async function ColumnsPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");
  if (state.kind !== "ok") return null;

  const notif = await getMyNotifications(supabase, state.userId);

  // 발행된 칼럼 (RLS가 발행+시점 필터)
  const { data: cols } = await supabase
    .from("columns")
    .select("id, title, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  // 내가 읽은 칼럼 (학생만 읽음 처리, 학부모는 빈 세트)
  const { data: reads } =
    state.role === "student"
      ? await supabase.from("column_reads").select("column_id")
      : { data: [] };
  const readSet = new Set((reads ?? []).map((r) => r.column_id));

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <div className="space-y-1">
        <h1 className="font-display text-[34px] leading-tight">칼럼</h1>
        <p className="text-muted-foreground text-sm">
          선생님이 쓴 국어 개념·독해 노하우 글이에요. 다 읽으면 [읽기 완료]를 눌러주세요.
        </p>
      </div>

      {(cols ?? []).length === 0 ? (
        <div className="rounded-[14px] border border-hairline bg-surface p-8 text-center">
          <BookOpen className="text-muted-foreground mx-auto size-8" />
          <p className="text-muted-foreground mt-3 text-sm">아직 올라온 칼럼이 없어요.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(cols ?? []).map((c) => {
            const read = readSet.has(c.id);
            return (
              <li key={c.id}>
                <Link
                  href={`/dashboard/columns/${c.id}`}
                  className="border-hairline bg-surface hover:border-primary/40 flex items-center justify-between gap-3 rounded-[14px] border p-5 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <BookOpen className="text-primary size-5 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{c.title}</p>
                      {c.published_at && (
                        <p className="text-muted-foreground text-xs">
                          {formatDt(c.published_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  {state.role === "student" && read && (
                    <span className="text-primary flex shrink-0 items-center gap-1 text-xs font-bold">
                      <Check className="size-4" />읽음
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

function Shell({
  children,
  notifItems,
  unreadCount,
}: {
  children: React.ReactNode;
  notifItems: NotificationItem[];
  unreadCount: number;
}) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <Wordmark size="md" />
          <DashboardNav active="columns" />
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell items={notifItems} unreadCount={unreadCount} />
          <ThemeToggle />
          <div className="hidden md:block">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 space-y-6">
        {children}
      </main>
    </div>
  );
}

function formatDt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}
