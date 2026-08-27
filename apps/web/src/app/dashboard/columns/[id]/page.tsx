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

  const { data: col } = await supabase
    .from("columns")
    .select("id, title, body, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!col) notFound();

  const { data: read } =
    state.role === "student"
      ? await supabase
          .from("column_reads")
          .select("column_id")
          .eq("column_id", id)
          .maybeSingle()
      : { data: null };

  const notif = await getMyNotifications(supabase, state.userId);

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard/columns">
          <ChevronLeft className="size-4" />
          칼럼 목록
        </Link>
      </Button>

      <article className="space-y-4">
        <header className="space-y-1">
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
