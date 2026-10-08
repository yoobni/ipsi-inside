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
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ColumnsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");
  if (state.kind !== "ok") return null;

  // 알림·카테고리·발행 칼럼·읽음 기록은 서로 독립 — 한 번에 보낸다
  const [notif, { data: categories }, { data: allCols }, { data: reads }] = await Promise.all([
    getMyNotifications(supabase, state.userId),
    // 카테고리 칩 (RLS가 보관 안 된 것만)
    supabase.from("column_categories").select("id, label").order("position"),
    // 발행된 칼럼 (RLS가 발행+시점 필터). 카테고리 필터는 아래서 메모리로 —
    // 전체 수가 작고, 칩에 "없는 카테고리" 파라미터가 와도 전체로 자연 fallback.
    supabase
      .from("columns")
      .select("id, title, category_id, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false }),
    // 내가 읽은 칼럼 (학생만 읽음 처리, 학부모는 빈 세트)
    state.role === "student"
      ? supabase.from("column_reads").select("column_id")
      : Promise.resolve({ data: [] as { column_id: string }[] }),
  ]);
  const readSet = new Set((reads ?? []).map((r) => r.column_id));
  const labelOf = new Map((categories ?? []).map((c) => [c.id, c.label] as const));
  const activeCategory = category && labelOf.has(category) ? category : null;
  const cols = activeCategory
    ? (allCols ?? []).filter((c) => c.category_id === activeCategory)
    : (allCols ?? []);

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <div className="space-y-1">
        <h1 className="font-display text-[34px] leading-tight">칼럼</h1>
        <p className="text-muted-foreground text-sm">
          선생님이 쓴 국어 개념·독해 노하우 글이에요. 다 읽으면 [읽기 완료]를 눌러주세요.
        </p>
      </div>

      {(categories ?? []).length > 0 && (
        <nav aria-label="카테고리" className="flex flex-wrap gap-2">
          <CategoryChip href="/dashboard/columns" active={!activeCategory}>
            전체
          </CategoryChip>
          {(categories ?? []).map((c) => (
            <CategoryChip
              key={c.id}
              href={`/dashboard/columns?category=${c.id}`}
              active={activeCategory === c.id}
            >
              {c.label}
            </CategoryChip>
          ))}
        </nav>
      )}

      {cols.length === 0 ? (
        <div className="rounded-[14px] border border-hairline bg-surface p-8 text-center">
          <BookOpen className="text-muted-foreground mx-auto size-8" />
          <p className="text-muted-foreground mt-3 text-sm">
            {activeCategory ? "이 카테고리에는 아직 칼럼이 없어요." : "아직 올라온 칼럼이 없어요."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {cols.map((c) => {
            const read = readSet.has(c.id);
            const catLabel = c.category_id ? labelOf.get(c.category_id) : null;
            return (
              <li key={c.id}>
                <Link
                  href={`/dashboard/columns/${c.id}`}
                  className="border-hairline bg-surface hover:border-primary/40 flex items-center justify-between gap-3 rounded-[14px] border p-5 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <BookOpen className="text-primary size-5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        {catLabel && <Badge variant="primary">{catLabel}</Badge>}
                        <p className="truncate font-bold">{c.title}</p>
                      </div>
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

function CategoryChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-full border px-3 py-1 text-xs font-bold transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-hairline bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground")
      }
    >
      {children}
    </Link>
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
