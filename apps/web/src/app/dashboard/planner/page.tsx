import { redirect } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { weekStartOf } from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import { todayKst } from "@/lib/kst";
import {
  getMyNotifications,
  type NotificationItem,
} from "@/lib/notifications";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNav } from "@/components/dashboard-nav";
import { Wordmark } from "@/components/wordmark";
import { PlannerWeek, type PlannerDay } from "./planner-week";

export const dynamic = "force-dynamic";

export default async function StudentPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; child?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");

  if (state.kind !== "ok") {
    return (
      <Shell notifItems={[]} unreadCount={0}>
        <p className="text-muted-foreground text-sm">플래너를 볼 수 없어요.</p>
      </Shell>
    );
  }

  const notif = await getMyNotifications(supabase, state.userId);
  const today = todayKst();
  const weekStart =
    sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week)
      ? weekStartOf(sp.week)
      : weekStartOf(today);

  // 학생은 본인, 학부모는 자녀의 플래너
  let targetStudentId = state.userId;
  let childName: string | null = null;
  if (state.role === "parent") {
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_id", state.userId);
    const childIds = (links ?? []).map((l) => l.student_id);
    const picked =
      sp.child && childIds.includes(sp.child) ? sp.child : (childIds[0] ?? null);
    if (!picked) {
      return (
        <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
          <EmptyState message="연결된 자녀가 없어요." />
        </Shell>
      );
    }
    targetStudentId = picked;
    const { data: child } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", picked)
      .maybeSingle();
    childName = child?.full_name ?? null;
  }

  // RLS가 published + 본인/자녀만 통과시키므로 여기서 추가 조건이 필요 없다
  const { data: week } = await supabase
    .from("planner_weeks")
    .select("id, week_start, weekly_comment")
    .eq("student_id", targetStudentId)
    .eq("week_start", weekStart)
    .maybeSingle();

  let days: PlannerDay[] = [];
  if (week) {
    const { data: blockRows } = await supabase
      .from("planner_blocks")
      .select("id, day_of_week, start_min, end_min, kind, label, color, memo")
      .eq("week_id", week.id)
      .order("day_of_week")
      .order("start_min");

    const blockIds = (blockRows ?? []).map((b) => b.id);
    const [{ data: taskRows }, { data: tagRows }] = await Promise.all([
      blockIds.length
        ? supabase
            .from("planner_tasks")
            .select("id, block_id, tag_id, title, position")
            .in("block_id", blockIds)
            .order("position")
        : Promise.resolve({ data: [] as never[] }),
      supabase.from("planner_tags").select("id, name").eq("archived", false),
    ]);

    const taskIds = (taskRows ?? []).map((t) => t.id);
    const { data: checkRows } = taskIds.length
      ? await supabase
          .from("planner_task_checks")
          .select("task_id, status, late_reason, photo_path, checked_at")
          .in("task_id", taskIds)
      : { data: [] };

    const tagName = new Map((tagRows ?? []).map((t) => [t.id, t.name]));
    const checkByTask = new Map(
      (checkRows ?? []).map((c) => [c.task_id, c]),
    );

    days = Array.from({ length: 7 }, (_, dow) => {
      const date = addDays(weekStart, dow);
      return {
        day_of_week: dow,
        date,
        editable: date === today && state.role === "student",
        blocks: (blockRows ?? [])
          .filter((b) => b.day_of_week === dow)
          .map((b) => ({
            id: b.id,
            start_min: b.start_min,
            end_min: b.end_min,
            kind: b.kind,
            label: b.label,
            color: b.color,
            memo: b.memo,
            tasks: (taskRows ?? [])
              .filter((t) => t.block_id === b.id)
              .map((t) => {
                const c = checkByTask.get(t.id);
                return {
                  id: t.id,
                  title: t.title,
                  tag_name: t.tag_id ? (tagName.get(t.tag_id) ?? null) : null,
                  status: c?.status ?? null,
                  late_reason: c?.late_reason ?? null,
                  photo_path: c?.photo_path ?? null,
                  checked_at: c?.checked_at ?? null,
                };
              }),
          })),
      };
    });
  }

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <div className="space-y-1">
        <h1 className="font-display text-[34px] leading-tight">주간 플래너</h1>
        <p className="text-muted-foreground text-sm">
          {state.role === "parent"
            ? `${childName ?? "자녀"} 학생의 이번 주 국어 학습 계획과 이행 상황이에요.`
            : "오늘 과제를 끝내면 바로 체크해요. 체크는 그날 밤 12시까지만 가능해요."}
        </p>
      </div>

      {!week ? (
        <EmptyState message="이 주에 배정된 플래너가 없어요." />
      ) : (
        <PlannerWeek
          weekStart={weekStart}
          today={today}
          days={days}
          weeklyComment={week.weekly_comment}
          readOnly={state.role === "parent"}
        />
      )}
    </Shell>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border-hairline bg-surface rounded-[14px] border p-8 text-center">
      <CalendarRange className="text-muted-foreground mx-auto size-8" />
      <p className="text-muted-foreground mt-3 text-sm">{message}</p>
    </div>
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
          <DashboardNav active="planner" />
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
