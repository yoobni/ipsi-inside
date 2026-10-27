import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  ListChecks,
  PencilLine,
} from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { COURSE_ITEM_KIND_LABEL, DELIVERY_KIND_LABEL, type CourseItemKind } from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import { getMyNotifications, type NotificationItem } from "@/lib/notifications";
import { loadClassroom, type ClassItem, type ClassSession } from "@/lib/courses";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNav } from "@/components/dashboard-nav";
import { Wordmark } from "@/components/wordmark";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HomeworkToggle } from "./homework-toggle";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<CourseItemKind, typeof FileText> = {
  material: FileText,
  test: ClipboardCheck,
  drill: ListChecks,
  guide: BookOpenCheck,
  homework: PencilLine,
};

/** 내 강의실 — 배부받은 회차만, 코스별·최신 배부순. 학부모는 자녀 강의실을 읽기 전용으로. */
export default async function ClassPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");
  if (state.kind !== "ok") redirect("/dashboard");

  // 알림은 대상 학생과 무관 — 먼저 띄운다
  const notifP = getMyNotifications(supabase, state.userId);
  const isStudent = state.role === "student";

  // 학생은 본인, 학부모는 자녀(?child= 로 고르고 기본은 첫 자녀)
  let targetId: string | null = state.userId;
  let children: { id: string; name: string }[] = [];
  if (!isStudent) {
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("student_id, profiles!parent_student_links_student_id_fkey(full_name)")
      .eq("parent_id", state.userId);
    children = (links ?? []).map((l) => {
      const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
      return { id: l.student_id, name: (p as { full_name: string } | null)?.full_name ?? "자녀" };
    });
    targetId = children.find((c) => c.id === sp.child)?.id ?? children[0]?.id ?? null;
  }

  const [notif, courses] = await Promise.all([
    notifP,
    targetId ? loadClassroom(supabase, targetId, isStudent) : Promise.resolve([]),
  ]);
  const childName = children.find((c) => c.id === targetId)?.name;

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <div className="space-y-1">
        <h1 className="font-display text-[34px] leading-tight">
          {isStudent ? "내 강의실" : `${childName ?? "자녀"}의 강의실`}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isStudent
            ? "들은 수업의 복습지·퀴즈·숙제가 회차별로 자동으로 들어와요."
            : "자녀가 들은 수업의 복습지·퀴즈·숙제와 진행 상황이에요."}
        </p>
      </div>

      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/class?child=${c.id}`}
              aria-current={c.id === targetId ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3 text-sm",
                c.id === targetId
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-hairline text-muted-foreground hover:text-foreground",
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {!isStudent && children.length === 0 ? (
        <Empty message="연결된 자녀가 없어요." />
      ) : courses.length === 0 ? (
        <Empty message="아직 열린 수업이 없어요. 수업을 들으면 여기에 복습지·숙제가 자동으로 들어와요." />
      ) : (
        <div className="space-y-8">
          {courses.map((c) => (
            <section key={c.id} className="space-y-3">
              <h2 className="flex min-w-0 items-center gap-2 text-lg font-extrabold">
                <GraduationCap className="text-primary size-5 shrink-0" />
                <span className="truncate">{c.title}</span>
                <span className="text-muted-foreground shrink-0 text-xs font-medium">{c.sessions.length}회차</span>
              </h2>
              <ul className="space-y-3">
                {c.sessions.map((s) => (
                  <li key={s.id}>
                    <SessionCard session={s} isStudent={isStudent} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Shell>
  );
}

function SessionCard({ session: s, isStudent }: { session: ClassSession; isStudent: boolean }) {
  const date = new Date(s.deliveredAt).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  return (
    <article
      className={cn(
        "border-hairline bg-surface rounded-[14px] border p-4 sm:p-5",
        s.status === "new" && "border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold break-words">{s.title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {date} · {DELIVERY_KIND_LABEL[s.deliveryKind]}
          </p>
          {s.summary && <p className="text-muted-foreground mt-1 text-sm break-words">{s.summary}</p>}
        </div>
        <StatusBadge status={s.status} />
      </div>
      {s.items.length > 0 && (
        <ul className="divide-hairline mt-3 divide-y border-t border-hairline">
          {s.items.map((it) => (
            <li key={it.id}>
              <ItemRow item={it} isStudent={isStudent} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: ClassSession["status"] }) {
  if (status === "new") return <Badge variant="primary" className="shrink-0 font-bold">NEW</Badge>;
  if (status === "done") return <Badge variant="success" className="shrink-0">수강완료</Badge>;
  return <Badge className="shrink-0">진행 중</Badge>;
}

/** 원본 화면 경로. 학부모는 자료만 연다(시험·훈련·가이드 화면은 응시자=로그인 사용자 기준). */
function itemHref(it: ClassItem, isStudent: boolean): string | null {
  if (!it.available || !it.refId) return null;
  switch (it.kind) {
    case "material":
      return `/dashboard/materials/${it.refId}`;
    case "test":
      return isStudent ? `/dashboard/tests/${it.refId}` : null;
    case "drill":
      return isStudent ? `/dashboard/drills/${it.refId}` : null;
    case "guide":
      return isStudent ? `/dashboard/guides/${it.refId}` : null;
    default:
      return null;
  }
}

function ItemRow({ item: it, isStudent }: { item: ClassItem; isStudent: boolean }) {
  const Icon = KIND_ICON[it.kind];
  const href = itemHref(it, isStudent);

  const body = (
    <>
      <Icon className="text-muted-foreground size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[11px]">{COURSE_ITEM_KIND_LABEL[it.kind]}</p>
        <p className={cn("truncate text-sm", !it.available && "text-muted-foreground")}>
          {it.available ? it.title : "준비 중"}
        </p>
        {it.kind === "homework" && it.dueDate && (
          <p className={cn("text-[11px]", it.overdue ? "text-destructive font-bold" : "text-muted-foreground")}>
            {it.overdue ? "마감 지남 · " : "마감 "}
            {it.dueDate.slice(5).replace("-", "/")}
          </p>
        )}
      </div>
      {it.hasPdf && it.available && (
        <span className="border-hairline text-muted-foreground shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold">
          PDF
        </span>
      )}
      {it.kind !== "homework" && it.available && <ItemStatus item={it} />}
      {href && <ChevronRight className="text-muted-foreground size-4 shrink-0" />}
    </>
  );

  if (it.kind === "homework") {
    return (
      <div className="flex min-h-12 items-center gap-3 py-1.5">
        {body}
        {isStudent ? (
          <HomeworkToggle itemId={it.id} done={!!it.done} title={it.title} />
        ) : (
          <ItemStatus item={it} />
        )}
      </div>
    );
  }
  return href ? (
    <Link href={href} className="hover:bg-muted/30 -mx-2 flex min-h-12 items-center gap-3 rounded-md px-2 py-1.5">
      {body}
    </Link>
  ) : (
    <div className="flex min-h-12 items-center gap-3 py-1.5">{body}</div>
  );
}

function ItemStatus({ item: it }: { item: ClassItem }) {
  if (it.done === null) return null;
  if (it.done) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3.5" />
        완료
      </span>
    );
  }
  if (it.kind === "guide" && it.progress && it.progress.total > 0 && it.progress.done > 0) {
    return (
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {it.progress.done}/{it.progress.total}단계
      </span>
    );
  }
  return <span className="text-muted-foreground shrink-0 text-xs">{it.kind === "homework" ? "미완료" : "아직"}</span>;
}

function Empty({ message }: { message: string }) {
  return (
    <div className="border-hairline bg-surface rounded-[14px] border p-8 text-center">
      <GraduationCap className="text-muted-foreground mx-auto size-8" />
      <p className="text-muted-foreground mt-3 text-sm break-keep">{message}</p>
    </div>
  );
}

function Shell({ children, notifItems, unreadCount }: { children: React.ReactNode; notifItems: NotificationItem[]; unreadCount: number }) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur">
        <div className="flex items-center gap-3 lg:gap-6">
          <Wordmark size="md" />
          <DashboardNav active="class" />
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell items={notifItems} unreadCount={unreadCount} />
          <ThemeToggle />
          <div className="hidden md:block"><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
