import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { STATS_AREA_WINDOW_DAYS, STATS_WEEKS } from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import { getMyNotifications, type NotificationItem } from "@/lib/notifications";
import {
  attendanceRate,
  deriveStats,
  getStudentStats,
  getTop3Boards,
  homeworkRate,
} from "@/lib/stats";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNav } from "@/components/dashboard-nav";
import { Wordmark } from "@/components/wordmark";
import { DeltaBadge } from "@/components/delta-badge";
import { StatTiles } from "./stat-tiles";
import { InsightCard } from "./insight-card";
import { TestTrendChart, type TrendPoint } from "./test-trend-chart";
import { WeeklyBarsChart, type WeekBar } from "./weekly-bars-chart";
import { AreaChart } from "./area-chart";
import { Top3Boards } from "./top3-boards";

export const dynamic = "force-dynamic";

/**
 * 학습 리포트 — 시험 추이·과제 수행률·출석률·일지 작성률·영역별 성취도.
 * "내가 좋아지고 있는지 / 어디가 부족한지"가 먼저 보이게 한 줄 인사이트와
 * 지난주 대비 변화를 숫자보다 앞에 둔다.
 *
 * 학부모는 ?student= 로 자녀를 고른다(연결된 자녀만, 기본 첫 자녀).
 */
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student: studentParam } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");
  if (state.kind !== "ok") return null;

  // 대상 학생 — 학생은 본인, 학부모는 연결된 자녀 중 하나
  let children: { id: string; full_name: string }[] = [];
  let targetId: string | null = state.userId;
  if (state.role === "parent") {
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_id", state.userId);
    const ids = (links ?? []).map((l) => l.student_id);
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids)
        .order("full_name");
      children = profiles ?? [];
    }
    targetId =
      (studentParam && children.find((c) => c.id === studentParam)?.id) ??
      children[0]?.id ??
      null;
  }

  const [notif, stats, top3] = await Promise.all([
    getMyNotifications(supabase, state.userId),
    targetId ? getStudentStats(supabase, targetId) : Promise.resolve(null),
    targetId ? getTop3Boards(supabase, targetId) : Promise.resolve(null),
  ]);

  const derived = stats ? deriveStats(stats) : null;
  const targetName = state.role === "parent" ? children.find((c) => c.id === targetId)?.full_name : null;

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <div className="space-y-1">
        <h1 className="font-display text-[34px] leading-tight">학습 리포트</h1>
        <p className="text-muted-foreground text-sm">
          {state.role === "student"
            ? "최근 8주의 과제·출석·일지와 시험 추이예요. 어디가 좋아지고 어디가 부족한지 봐요."
            : "자녀의 최근 8주 과제·출석·일지와 시험 추이예요."}
        </p>
      </div>

      {state.role === "parent" && children.length > 1 && (
        <nav aria-label="자녀 선택" className="flex flex-wrap gap-2">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/stats?student=${c.id}`}
              aria-current={c.id === targetId ? "page" : undefined}
              className={
                "rounded-full border px-3 py-1 text-xs font-bold transition-colors " +
                (c.id === targetId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-hairline bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground")
              }
            >
              {c.full_name}
            </Link>
          ))}
        </nav>
      )}
      {targetName && children.length <= 1 && (
        <p className="text-muted-foreground -mt-3 text-xs">{targetName}</p>
      )}

      {!stats || !derived ? (
        <EmptyCard
          title={targetId ? "리포트를 불러오지 못했어요" : "연결된 자녀가 없어요"}
          body={
            targetId
              ? "잠시 후 다시 열어주세요."
              : "원장님이 자녀 계정과 연결해주면 여기서 리포트를 볼 수 있어요."
          }
        />
      ) : !derived.hasAnyData ? (
        <>
          <EmptyCard
            title="아직 쌓인 기록이 없어요"
            body="플래너를 체크하고, 일지를 쓰고, 시험을 보면 여기에 변화가 그래프로 보여요."
          />
          {/* 기록이 없어도 다른 친구들의 TOP3는 자극이 된다 */}
          {top3 && <Top3Boards data={top3} viewerIsStudent={state.role === "student"} />}
        </>
      ) : (
        <>
          <InsightCard d={derived} />
          <StatTiles d={derived} />

          {top3 && <Top3Boards data={top3} viewerIsStudent={state.role === "student"} />}

          {/* 시험 추이 */}
          <Section
            title="시험 점수 변화"
            sub={`온라인 시험은 시트별 가장 잘 본 응시 기준(최근 ${stats.tests.length}개), 일일 테스트는 최근 30일`}
            aside={derived.tests.count >= 2 ? <DeltaBadge delta={derived.tests.delta} unit="점" /> : null}
          >
            {stats.tests.length + stats.daily_tests.length < 2 ? (
              <Hint>시험을 2회 이상 보면 추세가 그려져요.</Hint>
            ) : (
              <TestTrendChart points={buildTrendPoints(stats)} />
            )}
          </Section>

          {/* 과제 수행률 */}
          <Section
            title="주별 과제 수행률"
            sub={`발행된 플래너의 국어 과제 중 오늘까지 도래한 것 기준 (O+△)/전체 · 최근 ${STATS_WEEKS}주`}
            aside={<DeltaBadge delta={derived.homework.delta} />}
          >
            {stats.weeks.every((w) => !w.planner) ? (
              <Hint>플래너가 발행되면 수행률이 쌓여요.</Hint>
            ) : (
              <WeeklyBarsChart
                weeks={stats.weeks.map<WeekBar>((w, i) => ({
                  week_start: w.week_start,
                  rate: homeworkRate(w),
                  detail: `O ${w.hw_done} · △ ${w.hw_late} · X ${w.hw_missed} / 도래 ${w.hw_due}`,
                  isCurrent: i === stats.weeks.length - 1,
                }))}
                emptyLabel="플래너 없음"
              />
            )}
          </Section>

          {/* 출석률 */}
          <Section
            title="주별 출석률"
            sub="원장님이 마킹한 날 기준, 지각은 0.5로 계산"
            aside={<DeltaBadge delta={derived.attendance.delta} />}
          >
            {stats.weeks.every((w) => w.att_marked === 0) ? (
              <Hint>출석이 마킹되면 여기에 보여요.</Hint>
            ) : (
              <>
                <WeeklyBarsChart
                  weeks={stats.weeks.map<WeekBar>((w, i) => ({
                    week_start: w.week_start,
                    rate: attendanceRate(w),
                    detail: `출 ${w.att_present} · 지 ${w.att_late} · 결 ${w.att_absent}`,
                    isCurrent: i === stats.weeks.length - 1,
                  }))}
                  emptyLabel="마킹 없음"
                />
                <p className="text-muted-foreground mt-2 text-xs">
                  월별: 지난달{" "}
                  <b className="text-foreground">
                    {derived.monthlyAttendance.prev === null ? "–" : `${derived.monthlyAttendance.prev}%`}
                  </b>{" "}
                  → {derived.monthlyAttendance.currentLabel}{" "}
                  <b className="text-foreground">
                    {derived.monthlyAttendance.current === null ? "–" : `${derived.monthlyAttendance.current}%`}
                  </b>
                </p>
              </>
            )}
          </Section>

          {/* 영역별 성취도 */}
          {derived.areas.length > 0 && (
            <Section
              title="영역별 성취도"
              sub={`최근 ${STATS_AREA_WINDOW_DAYS}일 온라인 시험 정답률. 회색 막대는 그 이전 ${STATS_AREA_WINDOW_DAYS}일`}
            >
              <AreaChart
                areas={derived.areas.map((a) => ({
                  label: a.label,
                  rate: a.rate,
                  prevRate: a.prevRate,
                  total: a.total,
                  correct: a.correct,
                  isWeak: derived.weakArea?.source === a.source,
                }))}
              />
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                {derived.areas.map((a) => (
                  <li key={a.source} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground truncate">{a.label}</span>
                    <DeltaBadge delta={a.delta} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </Shell>
  );
}

/** 온라인 시험(날짜별 점수율)과 일일 테스트(날짜별 점수)를 한 배열로 — 날짜 오름차순 */
function buildTrendPoints(stats: NonNullable<Awaited<ReturnType<typeof getStudentStats>>>): TrendPoint[] {
  const byDate = new Map<string, TrendPoint>();
  for (const t of stats.tests) {
    const p = byDate.get(t.date) ?? { date: t.date };
    p.online = Math.round((t.score / t.total) * 100);
    p.title = t.title;
    p.score = t.score;
    p.total = t.total;
    byDate.set(t.date, p);
  }
  for (const d of stats.daily_tests) {
    const p = byDate.get(d.date) ?? { date: d.date };
    p.daily = d.score;
    byDate.set(d.date, p);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function Section({
  title,
  sub,
  aside,
  children,
}: {
  title: string;
  sub: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-hairline bg-surface rounded-[14px] border p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold">{title}</h2>
          <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">{sub}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">
      {children}
    </p>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-hairline bg-surface rounded-[14px] border p-8 text-center">
      <BarChart3 className="text-muted-foreground mx-auto size-8" />
      <p className="mt-3 text-sm font-bold">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs">{body}</p>
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
          <DashboardNav active="stats" />
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell items={notifItems} unreadCount={unreadCount} />
          <ThemeToggle />
          <div className="hidden md:block">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-8">{children}</main>
    </div>
  );
}
