import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock, Lock } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

type Sheet = {
  id: string;
  title: string;
  description: string | null;
  open_at: string | null;
  due_at: string | null;
  allow_retake: boolean;
  max_attempts: number | null;
};
type Attempt = {
  id: string;
  assignment_id: string;
  attempt_no: number;
  status: "in_progress" | "submitted";
  score: number | null;
  total_points: number | null;
};

type Item = {
  assignmentId: string;
  studentName?: string;
  sheet: Sheet;
  inProgress?: Attempt;
  latestSubmitted: Attempt | null;
  submittedCount: number;
  maxAtt: number;
  isLocked: boolean;
  isClosed: boolean;
  canTake: boolean;
  latestAttemptId: string | null;
};

export default async function TestsPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind !== "ok" || state.status !== "approved") redirect("/pending");
  if (state.role !== "student" && state.role !== "parent")
    redirect("/dashboard");

  // 대상 학생 id 결정
  let studentIds: string[] = [];
  let studentNameById: Record<string, string> = {};
  if (state.role === "student") {
    studentIds = [state.userId];
  } else {
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("student_id, profiles!parent_student_links_student_id_fkey(full_name)")
      .eq("parent_id", state.userId);
    studentIds = (links ?? []).map((l) => l.student_id);
    studentNameById = Object.fromEntries(
      (links ?? []).map((l) => {
        const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
        return [l.student_id, p?.full_name ?? "자녀"];
      }),
    );
  }

  let items: Item[] = [];
  if (studentIds.length > 0) {
    const { data: assignments } = await supabase
      .from("test_assignments")
      .select(
        "id, test_sheet_id, student_id, assigned_at, test_sheets(id, title, description, open_at, due_at, allow_retake, max_attempts)",
      )
      .in("student_id", studentIds)
      .order("assigned_at", { ascending: false });

    const assignmentIds = (assignments ?? []).map((a) => a.id);
    const { data: attempts } =
      assignmentIds.length > 0
        ? await supabase
            .from("test_attempts")
            .select(
              "id, assignment_id, attempt_no, status, score, total_points",
            )
            .in("assignment_id", assignmentIds)
            .order("attempt_no", { ascending: false })
        : { data: [] };

    const now = new Date();
    items = (assignments ?? [])
      .map((a) => {
        const sheet = (Array.isArray(a.test_sheets)
          ? a.test_sheets[0]
          : a.test_sheets) as Sheet | null;
        if (!sheet) return null;
        const mine = (attempts ?? []).filter((t) => t.assignment_id === a.id) as Attempt[];
        const inProgress = mine.find((t) => t.status === "in_progress");
        const submittedSorted = mine.filter((t) => t.status === "submitted");
        const latestSubmitted = submittedSorted[0] ?? null;
        const submittedCount = submittedSorted.length;
        const isLocked = sheet.open_at != null && new Date(sheet.open_at) > now;
        const isClosed = sheet.due_at != null && new Date(sheet.due_at) < now;
        const maxAtt = sheet.allow_retake
          ? sheet.max_attempts ?? Infinity
          : 1;
        const canTake =
          !isLocked &&
          !isClosed &&
          (inProgress != null || submittedCount < maxAtt);
        const latestAttemptId =
          inProgress?.id ?? latestSubmitted?.id ?? null;
        return {
          assignmentId: a.id,
          studentName:
            state.role === "parent" ? studentNameById[a.student_id] : undefined,
          sheet,
          inProgress,
          latestSubmitted,
          submittedCount,
          maxAtt,
          isLocked,
          isClosed,
          canTake,
          latestAttemptId,
        } satisfies Item;
      })
      .filter((x): x is Item => x !== null);
  }

  const isParent = state.role === "parent";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <Wordmark size="md" />
          <nav className="hidden md:flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">홈</Link>
            <span className="font-bold text-foreground border-b-2 border-primary pb-1">시험</span>
            <Link href="/dashboard/journal" className="hover:text-foreground">일지</Link>
            <span>강의</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden md:block">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-10">
        <div className="space-y-1">
          <p className="font-accent text-2xl text-muted-foreground">
            {isParent
              ? "자녀의 시험 현황이에요."
              : "오늘 시험을 풀어볼까요?"}
          </p>
          <h1 className="font-display text-[34px] leading-tight mt-1">
            {isParent ? "자녀 시험" : "내 시험"}
          </h1>
        </div>

        <ul className="mt-8 space-y-3">
          {items.length === 0 ? (
            <li className="rounded-[16px] border border-hairline bg-surface p-7 text-center">
              <p className="text-muted-foreground text-sm">
                {isParent
                  ? "자녀에게 배정된 시험이 없어요."
                  : "아직 배정된 시험이 없어요."}
              </p>
            </li>
          ) : (
            items.map((it) => (
              <li
                key={it.assignmentId}
                className="rounded-[16px] border border-hairline bg-surface p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {it.studentName && (
                      <p className="text-muted-foreground text-xs font-bold">
                        {it.studentName}
                      </p>
                    )}
                    <h2 className="font-display text-lg text-foreground">
                      {it.sheet.title}
                    </h2>
                    {it.sheet.description && (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {it.sheet.description}
                      </p>
                    )}
                    <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {it.sheet.open_at && (
                        <span>오픈 {fmt(it.sheet.open_at)}</span>
                      )}
                      {it.sheet.due_at && <span>마감 {fmt(it.sheet.due_at)}</span>}
                      {it.sheet.allow_retake ? (
                        <span>
                          재응시{" "}
                          {it.sheet.max_attempts
                            ? `${it.submittedCount}/${it.sheet.max_attempts}회`
                            : "무제한"}
                        </span>
                      ) : (
                        <span>1회만</span>
                      )}
                    </div>
                  </div>
                  <StatusPill status={statusOf(it)} />
                </div>

                {it.latestSubmitted && it.latestSubmitted.total_points && (
                  <p className="mt-3 text-sm">
                    최근 점수{" "}
                    <strong className="text-primary tabular-nums text-base">
                      {it.latestSubmitted.score} / {it.latestSubmitted.total_points}
                    </strong>
                    <span className="text-muted-foreground ml-1">점</span>
                  </p>
                )}

                <div className="mt-4 flex justify-end">
                  {isParent ? (
                    it.latestSubmitted ? (
                      <Link
                        href={`/dashboard/tests/${it.sheet.id}/result?attempt=${it.latestSubmitted.id}`}
                        className="text-primary inline-flex items-center gap-1 text-sm font-bold hover:underline"
                      >
                        결과 보기
                        <ArrowRight className="size-3.5" />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        자녀가 응시하면 결과가 표시돼요
                      </span>
                    )
                  ) : (
                    <Link
                      href={`/dashboard/tests/${it.sheet.id}`}
                      className="text-primary inline-flex items-center gap-1 text-sm font-bold hover:underline"
                    >
                      상세 보기
                      <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </main>
    </div>
  );
}

type Status =
  | "locked"
  | "closed"
  | "in_progress"
  | "submitted"
  | "open";

function statusOf(it: {
  isLocked: boolean;
  isClosed: boolean;
  inProgress?: Attempt;
  submittedCount: number;
}): Status {
  if (it.isLocked) return "locked";
  if (it.isClosed && !it.inProgress) return "closed";
  if (it.inProgress) return "in_progress";
  if (it.submittedCount > 0) return "submitted";
  return "open";
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string; icon: React.ReactNode }> = {
    locked: {
      label: "예정",
      cls: "text-muted-foreground border-hairline",
      icon: <Lock className="size-3" />,
    },
    closed: {
      label: "마감",
      cls: "text-muted-foreground border-hairline",
      icon: <Clock className="size-3" />,
    },
    in_progress: {
      label: "응시 중",
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      icon: <Clock className="size-3" />,
    },
    submitted: {
      label: "제출",
      cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      icon: <CheckCircle2 className="size-3" />,
    },
    open: {
      label: "응시 가능",
      cls: "border-primary/30 bg-primary/10 text-primary",
      icon: <ArrowRight className="size-3" />,
    },
  };
  const { label, cls, icon } = map[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
