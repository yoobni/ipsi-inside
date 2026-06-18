import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { ResultCharts } from "./result-charts";

export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const attemptId = sp.attempt;
  if (!attemptId) redirect(`/dashboard/tests/${id}`);

  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind !== "ok") redirect("/dashboard");

  // 본인(또는 자녀의) attempt 인지 확인
  const { data: attempt } = await supabase
    .from("test_attempts")
    .select(
      "id, attempt_no, score, total_points, submitted_at, status, assignment_id, test_assignments!inner(test_sheet_id, student_id)",
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) notFound();

  const asg = Array.isArray(attempt.test_assignments)
    ? attempt.test_assignments[0]
    : attempt.test_assignments;
  if (!asg || asg.test_sheet_id !== id) notFound();

  // 권한: 학생 본인 또는 자녀의 부모
  if (state.role === "student" && asg.student_id !== state.userId) notFound();
  if (state.role === "parent") {
    const { data: link } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_id", state.userId)
      .eq("student_id", asg.student_id)
      .maybeSingle();
    if (!link) notFound();
  }

  if (attempt.status !== "submitted") {
    redirect(`/dashboard/tests/${id}`);
  }

  const { data: sheet } = await supabase
    .from("test_sheets")
    .select("title")
    .eq("id", id)
    .maybeSingle();

  // 단원별
  const { data: unitStats } = await supabase.rpc("attempt_unit_stats", {
    p_attempt_id: attemptId,
  });

  // 문항별 정오답
  const { data: tsq } = await supabase
    .from("test_sheet_questions")
    .select(
      "position, question_id, questions(id, position_in_passage, stem, correct_answer, points, passages(title))",
    )
    .eq("test_sheet_id", id)
    .order("position");

  const { data: answers } = await supabase
    .from("student_answers")
    .select("question_id, selected, is_correct")
    .eq("attempt_id", attemptId);

  const answerMap = new Map(
    (answers ?? []).map(
      (a) => [a.question_id, a] as const,
    ),
  );

  const questions = (tsq ?? [])
    .map((r) => {
      const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
      if (!q) return null;
      const p = Array.isArray(q.passages) ? q.passages[0] : q.passages;
      const ans = answerMap.get(q.id);
      return {
        position: r.position,
        question_id: q.id,
        passageTitle: p?.title ?? "",
        position_in_passage: q.position_in_passage,
        correct_answer: q.correct_answer,
        points: q.points,
        selected: ans?.selected ?? null,
        is_correct: ans?.is_correct ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const correctCount = questions.filter((q) => q.is_correct).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-background/80 px-6 py-4 backdrop-blur">
        <Wordmark size="md" />
        <ThemeToggle />
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
        <Link
          href={`/dashboard/tests/${id}`}
          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          시험 상세
        </Link>

        <h1 className="font-display mt-3 text-[28px] leading-tight">
          {sheet?.title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {attempt.attempt_no}회차 ·{" "}
          {attempt.submitted_at &&
            new Date(attempt.submitted_at).toLocaleString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
        </p>

        {/* 점수 */}
        <section className="border-hairline mt-6 rounded-[16px] border bg-surface p-6 text-center">
          <p className="text-muted-foreground text-xs font-bold">최종 점수</p>
          <p className="font-display text-primary mt-2 text-[56px] leading-none tabular-nums">
            {attempt.score}
            <span className="text-muted-foreground text-xl">
              {" "}
              / {attempt.total_points}
            </span>
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            정답 {correctCount} / {questions.length}문항
            {attempt.total_points && attempt.total_points > 0 && (
              <span className="ml-2">
                ({Math.round(((attempt.score ?? 0) / attempt.total_points) * 100)}%)
              </span>
            )}
          </p>
        </section>

        {/* 차트 */}
        {(unitStats ?? []).length > 0 && (
          <section className="mt-6">
            <h2 className="font-bold">단원별 정답률</h2>
            <div className="border-hairline mt-3 rounded-[16px] border bg-surface p-6">
              <ResultCharts unitStats={unitStats ?? []} />
            </div>
          </section>
        )}

        {/* 문항별 */}
        <section className="mt-6">
          <h2 className="font-bold">문항별 결과</h2>
          <ul className="mt-3 divide-y rounded-[14px] border border-hairline bg-surface">
            {questions.map((q) => (
              <li
                key={q.question_id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="bg-muted text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded text-xs font-bold tabular-nums">
                  {q.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{q.passageTitle}</p>
                  <p className="text-muted-foreground text-[11px]">
                    내 답:{" "}
                    {q.selected != null
                      ? ["", "①", "②", "③", "④", "⑤"][q.selected]
                      : "—"}{" "}
                    · 정답:{" "}
                    {["", "①", "②", "③", "④", "⑤"][q.correct_answer]}
                  </p>
                </div>
                <span className="text-xs tabular-nums">{q.points}점</span>
                <span
                  className={
                    q.is_correct === true
                      ? "text-emerald-600 dark:text-emerald-400"
                      : q.is_correct === false
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {q.is_correct === true
                    ? "✓"
                    : q.is_correct === false
                      ? "✕"
                      : "–"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
