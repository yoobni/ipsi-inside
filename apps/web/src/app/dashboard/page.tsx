import Link from "next/link";
import { redirect } from "next/navigation";
import { User as UserIcon } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { weekStartOf } from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import { todayKst } from "@/lib/kst";
import { LogoutButton } from "@/components/logout-button";
import { DashboardNav } from "@/components/dashboard-nav";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { WrongAccountNotice } from "@/components/wrong-account-notice";
import { getMyNotifications } from "@/lib/notifications";
import { getActiveAnnouncements } from "@/lib/announcements";
import { getStudentStats, getTop3Boards } from "@/lib/stats";
import { JournalSubmit } from "./journal-submit";
import { TodayReportCard } from "./today-report";
import { WeeklySummary, type DailyRecord } from "./weekly-summary";
import { WeeklyPulse } from "./weekly-pulse";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");

  const today = todayKst();

  type TodaysJournal = {
    class_question: string | null;
    test_question: string | null;
    message_to_teacher: string | null;
    learning_log: string | null;
    submitted_at: string;
    updated_at: string;
  };
  type PublishedFeedback = {
    feedback: {
      overall_comment: string | null;
      better_than_yesterday: string | null;
      worse_than_yesterday: string | null;
      must_fix_tomorrow: string | null;
      publish_at: string;
    };
    journalDate: string;
    studentName?: string;
  };

  let todaysJournal: TodaysJournal | null = null;
  let latestPublishedFeedback: PublishedFeedback | null = null;
  // 최근 7일 일일 마킹 (학생/학부모 공통)
  let weeklyDays: { date: string; record: DailyRecord | null }[] = [];
  let weeklyStudentName: string | undefined;
  // 오늘 국어 플래너 진행률 — 학생/학부모 모두 홈에서 한눈에
  let plannerToday: { total: number; checked: number } | null = null;
  // 이번 주 요약 카드(리포트 입구) — 첫 자녀 기준
  let stats: Awaited<ReturnType<typeof getStudentStats>> = null;
  let top3: Awaited<ReturnType<typeof getTop3Boards>> = null;
  let notif: Awaited<ReturnType<typeof getMyNotifications>> = {
    items: [],
    unreadCount: 0,
  };
  let announcements: Awaited<ReturnType<typeof getActiveAnnouncements>> = [];

  if (state.kind === "ok") {
    // 알림·공지는 대상 학생과 무관 — 자녀 링크 조회를 기다리지 않고 먼저 띄운다
    const notifP = getMyNotifications(supabase, state.userId);
    const announcementsP = getActiveAnnouncements(supabase);

    // 학생: 본인 / 학부모: 자녀 전체. 예전엔 피드백용(전체)·주간용(limit 1)으로
    // 링크를 두 번 읽었는데 같은 테이블·같은 조건이라 한 번으로 합쳤다.
    // 주간 마킹·플래너 카드는 첫 자녀 기준(기존과 동일하게 정렬 없음).
    const targetStudentIds: string[] =
      state.role === "student"
        ? [state.userId]
        : await (async () => {
            const { data: links } = await supabase
              .from("parent_student_links")
              .select("student_id")
              .eq("parent_id", state.userId);
            return (links ?? []).map((l) => l.student_id);
          })();
    const targetStudentId: string | null = targetStudentIds[0] ?? null;

    // 아래 묶음은 서로 결과를 쓰지 않는다 — 한 번에 보낸다.
    // 각 묶음 안의 단계(피드백·플래너)는 앞 결과로 다음 조회를 정하므로 순차 유지.
    const [
      journalRes,
      feedbackRes,
      childNames,
      records,
      plannerRes,
      statsRes,
      top3Res,
      notifRes,
      announcementsRes,
    ] = await Promise.all([
      // 학생: 오늘 일지 조회
      state.role === "student"
        ? supabase
            .from("study_journals")
            .select(
              "class_question, test_question, message_to_teacher, learning_log, content, submitted_at, updated_at",
            )
            .eq("student_id", state.userId)
            .eq("journal_date", today)
            .maybeSingle()
            .then((r) => r.data)
        : Promise.resolve(null),

      // 가장 최근 발행된 피드백 (학생 본인 또는 자녀 중 누구든)
      (async () => {
        if (targetStudentIds.length === 0) return null;
        const { data: journals } = await supabase
          .from("study_journals")
          .select("id, journal_date, student_id")
          .in("student_id", targetStudentIds)
          .order("journal_date", { ascending: false })
          .limit(20);

        const journalIds = (journals ?? []).map((j) => j.id);
        if (journalIds.length === 0) return null;
        const { data: feedbacks } = await supabase
          .from("journal_feedbacks")
          .select(
            "journal_id, overall_comment, better_than_yesterday, worse_than_yesterday, must_fix_tomorrow, publish_at",
          )
          .in("journal_id", journalIds)
          .not("publish_at", "is", null)
          .lte("publish_at", new Date().toISOString())
          .order("publish_at", { ascending: false })
          .limit(1);

        const fb = (feedbacks ?? [])[0];
        if (!fb) return null;
        const j = (journals ?? []).find((j) => j.id === fb.journal_id);
        if (!j) return null;
        return { fb, j };
      })(),

      // 학부모: 자녀 이름 — 피드백 카드·주간 마킹 양쪽에서 쓴다(한 번에 조회)
      state.role === "parent" && targetStudentIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", targetStudentIds)
            .then(
              (r) =>
                new Map((r.data ?? []).map((p) => [p.id, p.full_name] as const)),
            )
        : Promise.resolve(new Map<string, string>()),

      // 최근 7일 일일 마킹
      (async () => {
        if (!targetStudentId) return null;
        // 오늘 포함 최근 7일
        const last7: string[] = [];
        const todayKstDate = new Date(`${today}T00:00:00Z`);
        for (let i = 6; i >= 0; i--) {
          const dt = new Date(todayKstDate);
          dt.setUTCDate(dt.getUTCDate() - i);
          last7.push(dt.toISOString().slice(0, 10));
        }
        const earliest = last7[0]!;

        const { data: records } = await supabase
          .from("daily_attendance")
          .select("date, attendance, homework_grade, test_score")
          .eq("student_id", targetStudentId)
          .gte("date", earliest)
          .lte("date", today);
        return { last7, records: records ?? [] };
      })(),

      // 오늘 국어 플래너 진행률 (week → blocks → tasks → checks 순차)
      (async (): Promise<{ total: number; checked: number } | null> => {
        if (!targetStudentId) return null;
        const weekStart = weekStartOf(today);
        const dayOfWeek = Math.round(
          (Date.parse(`${today}T00:00:00Z`) -
            Date.parse(`${weekStart}T00:00:00Z`)) /
            86400000,
        );

        const { data: week } = await supabase
          .from("planner_weeks")
          .select("id")
          .eq("student_id", targetStudentId)
          .eq("week_start", weekStart)
          .maybeSingle();
        if (!week) return null;

        const { data: blocks } = await supabase
          .from("planner_blocks")
          .select("id")
          .eq("week_id", week.id)
          .eq("kind", "korean")
          .eq("day_of_week", dayOfWeek);
        const blockIds = (blocks ?? []).map((b) => b.id);
        if (blockIds.length === 0) return null;

        const { data: tasks } = await supabase
          .from("planner_tasks")
          .select("id")
          .in("block_id", blockIds);
        const taskIds = (tasks ?? []).map((t) => t.id);
        if (taskIds.length === 0) return null;

        const { count } = await supabase
          .from("planner_task_checks")
          .select("task_id", { count: "exact", head: true })
          .in("task_id", taskIds);
        return { total: taskIds.length, checked: count ?? 0 };
      })(),

      // 학습 리포트 요약 + TOP3 (RPC 각 한 번)
      targetStudentId ? getStudentStats(supabase, targetStudentId) : Promise.resolve(null),
      targetStudentId ? getTop3Boards(supabase, targetStudentId) : Promise.resolve(null),

      // 알림 + 공지
      notifP,
      announcementsP,
    ]);

    const j = journalRes;
    if (j) {
      // 4갈래가 모두 비어있고 content만 있는 옛 레코드는 message_to_teacher로 폴백
      const hasNew =
        !!j.class_question ||
        !!j.test_question ||
        !!j.message_to_teacher ||
        !!j.learning_log;
      todaysJournal = {
        class_question: j.class_question,
        test_question: j.test_question,
        message_to_teacher:
          !hasNew && j.content ? j.content : j.message_to_teacher,
        learning_log: j.learning_log,
        submitted_at: j.submitted_at,
        updated_at: j.updated_at,
      };
    }

    if (feedbackRes) {
      const { fb, j: fj } = feedbackRes;
      latestPublishedFeedback = {
        feedback: {
          overall_comment: fb.overall_comment,
          better_than_yesterday: fb.better_than_yesterday,
          worse_than_yesterday: fb.worse_than_yesterday,
          must_fix_tomorrow: fb.must_fix_tomorrow,
          publish_at: fb.publish_at!,
        },
        journalDate: fj.journal_date,
        studentName:
          state.role === "parent" ? childNames.get(fj.student_id) : undefined,
      };
    }

    if (state.role === "parent" && targetStudentId) {
      weeklyStudentName = childNames.get(targetStudentId);
    }

    if (records) {
      const recordMap = new Map(
        records.records.map((r) => [r.date, r] as const),
      );
      weeklyDays = records.last7.map((d) => ({
        date: d,
        record: recordMap.get(d) ?? null,
      }));
    }

    plannerToday = plannerRes;
    stats = statsRes;
    top3 = top3Res;
    notif = notifRes;
    announcements = announcementsRes;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <Wordmark size="md" />
          <DashboardNav active="home" />
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell items={notif.items} unreadCount={notif.unreadCount} />
          <Link
            href="/dashboard/profile"
            aria-label="내 정보"
            className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md"
          >
            <UserIcon className="size-4" />
          </Link>
          <ThemeToggle />
          <div className="hidden md:block">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-10">
        {state.kind === "admin-on-web" && (
          <WrongAccountNotice
            title="관리자 계정으로 로그인되어 있어요"
            description="이 페이지는 학생/학부모용이에요. 로그아웃 후 학생/학부모 계정으로 다시 로그인해주세요."
          />
        )}

        {state.kind === "missing-profile" && (
          <WrongAccountNotice
            title="계정 정보를 찾을 수 없어요"
            description="인증 세션은 있지만 프로필이 없어요. 로그아웃 후 다시 가입해주세요."
          />
        )}

        {state.kind === "ok" && (
          <div className="space-y-8">
            {/* 공지사항 배너 */}
            {announcements.length > 0 && (
              <AnnouncementBanner items={announcements} />
            )}

            {/* 오늘 국어 플래너 진행률 */}
            {plannerToday && (
              <Link
                href="/dashboard/planner"
                className="border-hairline bg-surface flex items-center gap-4 rounded-[14px] border p-4 transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {state.role === "student"
                      ? "오늘 국어 과제"
                      : "자녀의 오늘 국어 과제"}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {plannerToday.checked === plannerToday.total
                      ? state.role === "student"
                        ? "오늘 몫은 모두 체크했어요"
                        : "오늘 몫을 모두 체크했어요"
                      : state.role === "student"
                        ? "밤 12시까지 체크할 수 있어요"
                        : "아직 체크하지 않은 과제가 있어요"}
                  </p>
                  <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{
                        width: `${Math.round((plannerToday.checked / plannerToday.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-lg font-bold">
                  {plannerToday.checked}
                  <span className="text-muted-foreground text-sm">
                    /{plannerToday.total}
                  </span>
                </span>
              </Link>
            )}

            {/* 이번 주 요약 + 리포트 입구 (모바일엔 내비가 없어 여기가 유일한 길) */}
            {(stats || top3) && (
              <WeeklyPulse
                stats={stats}
                top3={top3}
                studentName={state.role === "parent" ? weeklyStudentName : undefined}
              />
            )}

            {/* ★ 발행된 오늘의 리포트 — 최상단 */}
            {latestPublishedFeedback && (
              <TodayReportCard
                feedback={latestPublishedFeedback.feedback}
                journalDate={latestPublishedFeedback.journalDate}
                studentName={latestPublishedFeedback.studentName}
              />
            )}

            {state.role === "student" ? (
              <StudentDashboard
                fullName={state.fullName}
                school={state.school}
                grade={state.grade}
                todaysJournal={todaysJournal}
                today={today}
                weeklyDays={weeklyDays}
              />
            ) : (
              <ParentDashboard
                fullName={state.fullName}
                weeklyDays={weeklyDays}
                studentName={weeklyStudentName}
              />
            )}
          </div>
        )}

        <div className="mt-12 md:hidden">
          <LogoutButton />
        </div>
      </main>
    </div>
  );
}

function StudentDashboard({
  fullName,
  school,
  grade,
  todaysJournal,
  today,
  weeklyDays,
}: {
  fullName: string;
  school: string | null;
  grade: number | null;
  todaysJournal: {
    class_question: string | null;
    test_question: string | null;
    message_to_teacher: string | null;
    learning_log: string | null;
    submitted_at: string;
    updated_at: string;
  } | null;
  today: string;
  weeklyDays: { date: string; record: DailyRecord | null }[];
}) {
  return (
    <div className="space-y-6">
      <section>
        <p className="font-accent text-2xl text-muted-foreground">
          오늘도 1지문 어때요?
        </p>
        <h1 className="font-display text-[34px] leading-tight mt-1">
          {fullName}님, 환영해요
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {school} · {grade ? `${grade}학년` : ""}
        </p>
      </section>

      <JournalSubmit todayDate={today} existing={todaysJournal} />

      {weeklyDays.length > 0 && <WeeklySummary days={weeklyDays} />}
    </div>
  );
}

function ParentDashboard({
  fullName,
  weeklyDays,
  studentName,
}: {
  fullName: string;
  weeklyDays: { date: string; record: DailyRecord | null }[];
  studentName?: string;
}) {
  return (
    <div className="space-y-6">
      <section>
        <p className="font-accent text-2xl text-muted-foreground">
          꾸준한 학습, 함께 지켜볼게요.
        </p>
        <h1 className="font-display text-[34px] leading-tight mt-1">
          {fullName} 학부모님
        </h1>
      </section>

      {weeklyDays.length > 0 ? (
        <WeeklySummary days={weeklyDays} studentName={studentName} />
      ) : (
        <section className="rounded-[16px] border border-hairline bg-surface p-7">
          <h2 className="text-base font-extrabold">자녀 학습 리포트</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            자녀가 매일 작성한 학습 일지와 원장님 피드백이 발행되면 상단 카드에 표시돼요.
          </p>
        </section>
      )}
    </div>
  );
}
