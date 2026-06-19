import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import type { QuestionChoice } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id, attemptId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: attempt } = await supabase
    .from("test_attempts")
    .select(
      "id, attempt_no, status, score, total_points, started_at, submitted_at, assignment_id",
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) notFound();

  const { data: assignment } = await supabase
    .from("test_assignments")
    .select("test_sheet_id, student_id")
    .eq("id", attempt.assignment_id)
    .maybeSingle();
  if (!assignment || assignment.test_sheet_id !== id) notFound();

  const [{ data: student }, { data: sheet }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, school, grade")
      .eq("id", assignment.student_id)
      .maybeSingle(),
    supabase.from("test_sheets").select("title").eq("id", id).maybeSingle(),
  ]);

  // 단원별 stats
  const { data: unitStats } = await supabase.rpc("attempt_unit_stats", {
    p_attempt_id: attemptId,
  });

  // 문항 + 답안
  const { data: tsq } = await supabase
    .from("test_sheet_questions")
    .select(
      "position, question_id, questions(id, passage_id, position_in_passage, stem, supplementary, choices, correct_answer, points)",
    )
    .eq("test_sheet_id", id)
    .order("position");

  const passageIds = Array.from(
    new Set(
      (tsq ?? [])
        .map((r) => {
          const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
          return q?.passage_id;
        })
        .filter((v): v is string => !!v),
    ),
  );

  const { data: passages } =
    passageIds.length > 0
      ? await supabase
          .from("passages")
          .select("id, title")
          .in("id", passageIds)
      : { data: [] };
  const passageTitleMap = new Map(
    (passages ?? []).map((p) => [p.id, p.title] as const),
  );

  const { data: answers } = await supabase
    .from("student_answers")
    .select("question_id, selected, is_correct")
    .eq("attempt_id", attemptId);
  const answerMap = new Map(
    (answers ?? []).map((a) => [a.question_id, a] as const),
  );

  const rows = (tsq ?? [])
    .map((r) => {
      const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
      if (!q) return null;
      const ans = answerMap.get(q.id);
      return {
        position: r.position,
        question_id: q.id,
        passage_title: passageTitleMap.get(q.passage_id) ?? "",
        position_in_passage: q.position_in_passage,
        stem: q.stem,
        supplementary: q.supplementary,
        choices: q.choices as QuestionChoice[],
        correct_answer: q.correct_answer,
        points: q.points,
        selected: ans?.selected ?? null,
        is_correct: ans?.is_correct ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const correctCount = rows.filter((r) => r.is_correct).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/tests/${id}`}>
            <ChevronLeft className="size-4" />
            시험지로
          </Link>
        </Button>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {student?.full_name} · {attempt.attempt_no}회차
        </h1>
        <p className="text-muted-foreground text-sm">
          {sheet?.title}
          {student?.school && ` · ${student.school}`}
          {student?.grade && ` ${student.grade}학년`}
        </p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
          {attempt.submitted_at && (
            <span>
              제출{" "}
              {new Date(attempt.submitted_at).toLocaleString("ko-KR", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <Badge variant={attempt.status === "submitted" ? "success" : "warning"}>
            {attempt.status === "submitted" ? "제출됨" : "응시 중"}
          </Badge>
        </div>
      </div>

      {/* 점수 */}
      <section className="rounded-md border bg-card">
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs">최종 점수</p>
            <p className="text-primary mt-1 text-3xl font-bold tabular-nums">
              {attempt.score ?? "-"}
              <span className="text-muted-foreground text-lg">
                {" "}
                / {attempt.total_points ?? "-"}
              </span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">정답</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {correctCount} / {rows.length}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">정답률</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {rows.length > 0
                ? Math.round((correctCount / rows.length) * 100)
                : 0}
              %
            </p>
          </div>
        </div>
      </section>

      {/* 단원별 */}
      {(unitStats ?? []).length > 0 && (
        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">단원별 정답률</h2>
          </div>
          <ul className="divide-y">
            {(unitStats ?? []).map((u, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="font-medium">
                  {u.unit_major}
                  {u.unit_minor && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {u.unit_minor}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <div className="bg-muted relative h-2 w-32 overflow-hidden rounded-full">
                    <div
                      className="bg-primary absolute inset-y-0 left-0"
                      style={{ width: `${u.accuracy}%` }}
                    />
                  </div>
                  <span className="w-20 text-right tabular-nums">
                    {u.accuracy}% ({u.correct}/{u.total})
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 문항별 결과 */}
      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">문항별 답안</h2>
        </div>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.question_id} className="px-4 py-4">
              <div className="flex items-baseline gap-2">
                <span className="text-primary text-lg font-bold tabular-nums">
                  {r.position}
                </span>
                <span className="text-muted-foreground text-xs">
                  · {r.passage_title} #{r.position_in_passage} · {r.points}점
                </span>
                <span
                  className={
                    "ml-auto text-sm font-bold " +
                    (r.is_correct === true
                      ? "text-emerald-600 dark:text-emerald-400"
                      : r.is_correct === false
                        ? "text-destructive"
                        : "text-muted-foreground")
                  }
                >
                  {r.is_correct === true
                    ? "✓ 정답"
                    : r.is_correct === false
                      ? "✕ 오답"
                      : "미응답"}
                </span>
              </div>
              <div
                className="prose prose-sm dark:prose-invert mt-2 max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: r.stem }}
              />
              {r.supplementary && (
                <div className="bg-muted/30 mt-2 rounded-md border p-3">
                  <p className="text-muted-foreground mb-1 text-[10px] font-bold">
                    〈보기〉
                  </p>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: r.supplementary }}
                  />
                </div>
              )}
              <div className="mt-3 space-y-1">
                {r.choices.map((c) => {
                  const isCorrect = c.no === r.correct_answer;
                  const isSelected = c.no === r.selected;
                  return (
                    <div
                      key={c.no}
                      className={
                        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm " +
                        (isCorrect
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : isSelected
                            ? "border-destructive/30 bg-destructive/5"
                            : "border-input")
                      }
                    >
                      <span
                        className={
                          "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold " +
                          (isCorrect
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : isSelected
                              ? "border-destructive text-destructive"
                              : "border-input text-muted-foreground")
                        }
                      >
                        {["", "①", "②", "③", "④", "⑤"][c.no]}
                      </span>
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none flex-1"
                        dangerouslySetInnerHTML={{ __html: c.text }}
                      />
                      {isCorrect && (
                        <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                          정답
                        </span>
                      )}
                      {isSelected && !isCorrect && (
                        <span className="text-destructive text-[10px] font-bold">
                          학생 선택
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
