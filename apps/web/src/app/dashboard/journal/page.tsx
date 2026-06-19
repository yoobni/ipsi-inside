import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { todayKst } from "@/lib/kst";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { getMyNotifications, type NotificationItem } from "@/lib/notifications";
import { JournalCalendar } from "./journal-calendar";

export const dynamic = "force-dynamic";

export default async function JournalArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; studentId?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind !== "ok" || state.status !== "approved") redirect("/dashboard");

  const sp = await searchParams;
  const month = sp.month ?? todayKst().slice(0, 7); // YYYY-MM
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(monthNum)) {
    redirect("/dashboard/journal");
  }

  // 대상 학생 결정
  let targetStudentIds: string[] = [];
  let studentChoices: { id: string; full_name: string }[] = [];
  let selectedStudentId: string | null = null;

  if (state.role === "student") {
    targetStudentIds = [state.userId];
    selectedStudentId = state.userId;
  } else {
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_id", state.userId);
    const childIds = (links ?? []).map((l) => l.student_id);
    if (childIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", childIds);
      studentChoices = (profs ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
      }));
      const queryStudent = sp.studentId;
      selectedStudentId =
        queryStudent && childIds.includes(queryStudent) ? queryStudent : (childIds[0] ?? null);
      targetStudentIds = selectedStudentId ? [selectedStudentId] : [];
    }
  }

  if (targetStudentIds.length === 0) {
    return (
      <Shell>
        <p className="text-muted-foreground text-sm">연결된 학생이 없어요.</p>
      </Shell>
    );
  }

  // 해당 월의 1일~말일 범위
  const monthStart = `${year}-${String(monthNum).padStart(2, "0")}-01`;
  const nextMonth = new Date(Date.UTC(year, monthNum, 1));
  const monthEnd = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const { data: journals } = await supabase
    .from("study_journals")
    .select("id, journal_date, content")
    .in("student_id", targetStudentIds)
    .gte("journal_date", monthStart)
    .lt("journal_date", monthEnd)
    .order("journal_date");

  const journalIds = (journals ?? []).map((j) => j.id);
  const { data: feedbacks } =
    journalIds.length > 0
      ? await supabase
          .from("journal_feedbacks")
          .select(
            "journal_id, overall_comment, better_than_yesterday, worse_than_yesterday, must_fix_tomorrow, publish_at",
          )
          .in("journal_id", journalIds)
          .not("publish_at", "is", null)
          .lte("publish_at", new Date().toISOString())
      : { data: [] };

  const feedbackByJournalId = new Map(
    (feedbacks ?? []).map((f) => [f.journal_id, f] as const),
  );

  const dayItems = (journals ?? []).map((j) => ({
    date: j.journal_date,
    journalId: j.id,
    content: j.content,
    feedback: feedbackByJournalId.get(j.id) ?? null,
  }));

  const notif = await getMyNotifications(supabase, state.userId);

  return (
    <Shell notif={notif}>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <ChevronLeft className="size-4" />
            홈
          </Link>
        </Button>
      </div>

      <div className="space-y-1">
        <h1 className="font-display text-[34px] leading-tight">학습 일지 기록</h1>
        <p className="text-muted-foreground text-sm">
          날짜를 누르면 그 날 일지와 원장님 피드백을 볼 수 있어요.
        </p>
      </div>

      <JournalCalendar
        year={year}
        month={monthNum}
        items={dayItems}
        studentChoices={studentChoices}
        selectedStudentId={selectedStudentId}
        viewerRole={state.role}
      />
    </Shell>
  );
}

function Shell({
  children,
  notif,
}: {
  children: React.ReactNode;
  notif: { items: NotificationItem[]; unreadCount: number };
}) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <Wordmark size="md" />
        <div className="flex items-center gap-2">
          <NotificationBell items={notif.items} unreadCount={notif.unreadCount} />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 space-y-6">
        {children}
      </main>
    </div>
  );
}
