import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Download, Eye, FileText } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { formatBytes } from "@ipsi/lib/format";
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
    .select("id, title, description, audience, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!m) notFound();

  const { data: fileRows } = await supabase
    .from("material_files")
    .select("id, file_name, file_size_bytes, position")
    .eq("material_id", id)
    .order("position");
  const files = fileRows ?? [];
  const totalSize = formatBytes(
    files.reduce((s, f) => s + f.file_size_bytes, 0),
  );

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
          파일 {files.length}개 · {totalSize}
          {m.published_at && ` · 발행 ${formatDt(m.published_at)}`}
        </p>
      </div>

      {files.length === 0 ? (
        <p className="text-muted-foreground rounded-[14px] border border-hairline bg-surface p-8 text-center text-sm">
          파일이 없어요.
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="border-hairline bg-surface flex items-center gap-3 rounded-[14px] border p-3"
            >
              <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.file_name}</p>
                <p className="text-muted-foreground text-[10px]">
                  {formatBytes(f.file_size_bytes)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`/dashboard/materials/${m.id}/view?file=${f.id}`}
                    target="_blank"
                    rel="noopener"
                  >
                    <Eye className="size-4" /> 보기
                  </a>
                </Button>
                <Button asChild size="sm">
                  <a href={`/dashboard/materials/${m.id}/download?file=${f.id}`}>
                    <Download className="size-4" /> 받기
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 파일이 하나면 인앱 뷰어를 바로 노출 (단일 자료 UX 유지) */}
      {files.length === 1 && (
        <div className="border-hairline overflow-hidden rounded-[14px] border bg-muted">
          <iframe
            src={`/dashboard/materials/${m.id}/view?file=${files[0].id}`}
            title={m.title}
            className="h-[80vh] w-full bg-white"
          />
        </div>
      )}

      <p className="text-muted-foreground text-center text-[11px]">
        PDF가 보이지 않으면 [받기]로 내려받아 주세요.
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
