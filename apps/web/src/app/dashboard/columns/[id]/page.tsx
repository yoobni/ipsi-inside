import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { getMyNotifications, type NotificationItem } from "@/lib/notifications";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNav } from "@/components/dashboard-nav";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReadButton } from "./read-button";

export const dynamic = "force-dynamic";

export default async function ColumnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");
  if (state.kind !== "ok") return null;

  // 칼럼·읽음 여부·알림을 한 번에. 읽음 조회는 본인 행만(RLS)이라 칼럼이
  // 안 보여 404가 나면 결과는 그냥 버려진다.
  const [{ data: col }, { data: read }, notif] = await Promise.all([
    supabase
      .from("columns")
      .select("id, title, body, category_id, published_at")
      .eq("id", id)
      .maybeSingle(),
    state.role === "student"
      ? supabase
          .from("column_reads")
          .select("column_id")
          .eq("column_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getMyNotifications(supabase, state.userId),
  ]);
  if (!col) notFound();

  // 카테고리 라벨 — 보관된 카테고리면 RLS가 안 돌려주므로 배지만 생략된다
  const { data: cat } = col.category_id
    ? await supabase
        .from("column_categories")
        .select("id, label")
        .eq("id", col.category_id)
        .maybeSingle()
    : { data: null };

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard/columns">
          <ChevronLeft className="size-4" />
          칼럼 목록
        </Link>
      </Button>

      <article className="space-y-4">
        <header className="space-y-2">
          {cat && (
            <Link href={`/dashboard/columns?category=${cat.id}`}>
              <Badge variant="primary">{cat.label}</Badge>
            </Link>
          )}
          <h1 className="font-display text-[30px] leading-tight">{col.title}</h1>
          {col.published_at && (
            <p className="text-muted-foreground text-xs">
              {new Date(col.published_at).toLocaleDateString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}
            </p>
          )}
        </header>
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-[15px] leading-[1.75]"
          dangerouslySetInnerHTML={{ __html: col.body }}
        />
      </article>

      {/* 학부모는 열람만, 읽기 완료는 학생 기능 */}
      {state.role === "student" && (
        <div className="pt-2">
          <ReadButton columnId={col.id} alreadyRead={!!read} />
        </div>
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
