import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock, Lock } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function StudentTestsPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind !== "ok" || state.status !== "approved") redirect("/pending");
  if (state.role !== "student") redirect("/dashboard");

  // 배정 + 시험지 메타
  const { data: assignments } = await supabase
    .from("test_assignments")
    .select(
      "id, test_sheet_id, assigned_at, test_sheets(id, title, description, target_school, target_grade, open_at, due_at, allow_retake, max_attempts)",
    )
    .eq("student_id", state.userId)
    .order("assigned_at", { ascending: false });

  const assignmentIds = (assignments ?? []).map((a) => a.id);

  const { data: attempts } =
    assignmentIds.length > 0
      ? await supabase
          .from("test_attempts")
          .select("assignment_id, attempt_no, status, score, total_points, submitted_at")
          .in("assignment_id", assignmentIds)
          .order("attempt_no", { ascending: false })
      : { data: [] };

  // 학생 시점 timeline
  const now = new Date();
  const items = (assignments ?? [])
    .map((a) => {
      const sheet = (Array.isArray(a.test_sheets) ? a.test_sheets[0] : a.test_sheets) as
        | {
            id: string;
            title: string;
            description: string | null;
            target_school: string | null;
            target_grade: number | null;
            open_at: string | null;
            due_at: string | null;
            allow_retake: boolean;
            max_attempts: number | null;
          }
        | null;
      if (!sheet) return null;
      const mine = (attempts ?? []).filter((t) => t.assignment_id === a.id);
      const inProgress = mine.find((t) => t.status === "in_progress");
      const submittedSorted = mine.filter((t) => t.status === "submitted");
      const latestSubmitted = submittedSorted[0] ?? null;
      const submittedCount = submittedSorted.length;
      const isLocked = sheet.open_at != null && new Date(sheet.open_at) > now;
      const isClosed = sheet.due_at != null && new Date(sheet.due_at) < now;
      const maxAtt = sheet.allow_retake ? sheet.max_attempts ?? Infinity : 1;
      const canTake =
        !isLocked &&
        !isClosed &&
        (inProgress != null || submittedCount < maxAtt);
      return {
        assignmentId: a.id,
        sheet,
        inProgress,
        latestSubmitted,
        submittedCount,
        maxAtt,
        isLocked,
        isClosed,
        canTake,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

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
            오늘 시험을 풀어볼까요?
          </p>
          <h1 className="font-display text-[34px] leading-tight mt-1">내 시험</h1>
        </div>

        <ul className="mt-8 space-y-3">
          {items.length === 0 ? (
            <li className="rounded-[16px] border border-hairline bg-surface p-7 text-center">
              <p className="text-muted-foreground text-sm">
                아직 배정된 시험이 없어요.
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
                        <span>
                          오픈 {fmt(it.sheet.open_at)}
                        </span>
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
                  <Link
                    href={`/dashboard/tests/${it.sheet.id}`}
                    className="text-primary inline-flex items-center gap-1 text-sm font-bold hover:underline"
                  >
                    상세 보기
                    <ArrowRight className="size-3.5" />
                  </Link>
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
  inProgress?: { status: string } | null;
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

