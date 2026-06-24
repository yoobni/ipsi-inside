import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { MATERIAL_AUDIENCE_LABEL, type MaterialAudience } from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import {
  getMyNotifications,
  type NotificationItem,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

export const dynamic = "force-dynamic";

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");

  const { data: m } = await supabase
    .from("materials")
    .select(
      "id, title, description, audience, file_name, file_size_bytes, published_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!m) notFound();

  const notif =
    state.kind === "ok"
      ? await getMyNotifications(supabase, state.userId)
      : { items: [], unreadCount: 0 };

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/materials">
            <ChevronLeft className="size-4" />
            자료실
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[28px] leading-tight">{m.title}</h1>
          <span className="border-hairline text-muted-foreground rounded-full border px-2 py-0.5 text-[10px]">
            {MATERIAL_AUDIENCE_LABEL[m.audience as MaterialAudience]}
          </span>
        </div>
        {m.description && (
          <p className="text-muted-foreground text-sm whitespace-pre-wrap">
            {m.description}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {m.file_name} · {(m.file_size_bytes / 1024 / 1024).toFixed(1)}MB
          {m.published_at && ` · 발행 ${formatDt(m.published_at)}`}
        </p>
      </div>

      <div className="flex justify-end">
        <Button asChild>
          <a href={`/dashboard/materials/${m.id}/download`}>
            <Download className="size-4" /> 다운로드
          </a>
        </Button>
      </div>

      {/*
        iframe src = view route → 5분 TTL signed URL로 302 redirect.
        브라우저가 PDF를 inline으로 표시. 모바일에서 일부 브라우저(iOS Safari 등)는
        embed가 약해서 그 경우 다운로드 버튼이 fallback.
      */}
      <div className="border-hairline overflow-hidden rounded-[14px] border bg-muted">
        <iframe
          src={`/dashboard/materials/${m.id}/view`}
          title={m.title}
          className="h-[80vh] w-full bg-white"
        />
      </div>

      <p className="text-muted-foreground text-center text-[11px]">
        PDF가 보이지 않으면 위의 [다운로드] 버튼으로 받아주세요.
      </p>
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
            <Link href="/dashboard" className="hover:text-foreground">
              홈
            </Link>
            <Link href="/dashboard/tests" className="hover:text-foreground">
              시험
            </Link>
            <Link href="/dashboard/journal" className="hover:text-foreground">
              일지
            </Link>
            <Link
              href="/dashboard/materials"
              className="font-bold text-foreground border-b-2 border-primary pb-1"
            >
              자료
            </Link>
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
