import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { MATERIAL_AUDIENCE_LABEL } from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import {
  getMyNotifications,
  type NotificationItem,
} from "@/lib/notifications";
import { getActiveMaterials } from "@/lib/materials";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");

  if (state.kind !== "ok") {
    return (
      <Shell notifItems={[]} unreadCount={0}>
        <p className="text-muted-foreground text-sm">자료를 볼 수 없어요.</p>
      </Shell>
    );
  }

  const notif = await getMyNotifications(supabase, state.userId);
  const materials = await getActiveMaterials(supabase);

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <div className="space-y-1">
        <h1 className="font-display text-[34px] leading-tight">자료실</h1>
        <p className="text-muted-foreground text-sm">
          학원에서 배부한 PDF 자료를 다운로드할 수 있어요.
        </p>
      </div>

      {materials.length === 0 ? (
        <div className="rounded-[14px] border border-hairline bg-surface p-8 text-center">
          <FileText className="text-muted-foreground mx-auto size-8" />
          <p className="text-muted-foreground mt-3 text-sm">
            아직 받은 자료가 없어요.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {materials.map((m) => (
            <li
              key={m.id}
              className="border-hairline bg-surface flex items-start gap-3 rounded-[14px] border p-4 transition-colors hover:bg-muted/30 sm:items-center"
            >
              <Link
                href={`/dashboard/materials/${m.id}`}
                className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md"
                aria-label="자료 열기"
              >
                <FileText className="size-5" />
              </Link>
              <Link
                href={`/dashboard/materials/${m.id}`}
                className="min-w-0 flex-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold">{m.title}</h3>
                  <span className="border-hairline text-muted-foreground rounded-full border px-2 py-0.5 text-[10px]">
                    {MATERIAL_AUDIENCE_LABEL[m.audience]}
                  </span>
                </div>
                {m.description && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {m.description}
                  </p>
                )}
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  파일 {m.file_count}개 · {(m.total_bytes / 1024 / 1024).toFixed(1)}MB
                  {m.published_at && ` · 발행 ${formatDt(m.published_at)}`}
                </p>
              </Link>
              <div className="flex shrink-0 gap-1">
                <Button asChild size="sm">
                  <Link href={`/dashboard/materials/${m.id}`}>
                    열기 <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
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
          <nav className="hidden md:flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">홈</Link>
            <Link href="/dashboard/tests" className="hover:text-foreground">시험</Link>
            <Link href="/dashboard/journal" className="hover:text-foreground">일지</Link>
            <span className="font-bold text-foreground border-b-2 border-primary pb-1">자료</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell items={notifItems} unreadCount={unreadCount} />
          <ThemeToggle />
          <div className="hidden md:block">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 space-y-6">
        {children}
      </main>
    </div>
  );
}

function formatDt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
