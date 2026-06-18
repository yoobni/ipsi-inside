import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReportCharts } from "./report-charts";

export const dynamic = "force-dynamic";

export default async function TestReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { id } = await params;
  const { studentId: queryStudentId } = await searchParams;

  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind !== "ok" || state.status !== "approved") redirect("/dashboard");

  // 대상 학생 결정
  let studentId: string;
  if (state.role === "student") {
    studentId = state.userId;
  } else {
    // 학부모: 쿼리 파라미터 또는 첫 자녀
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_id", state.userId);
    const childIds = (links ?? []).map((l) => l.student_id);
    if (queryStudentId && childIds.includes(queryStudentId)) {
      studentId = queryStudentId;
    } else if (childIds[0]) {
      studentId = childIds[0];
    } else {
      redirect("/dashboard/tests");
    }
  }

  const { data: sheet } = await supabase
    .from("test_sheets")
    .select("id, title, target_school, target_grade, test_date")
    .eq("id", id)
    .maybeSingle();
  if (!sheet) notFound();

  const { data: assignment } = await supabase
    .from("test_assignments")
    .select("status")
    .eq("test_sheet_id", id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!assignment) notFound();

  const { data: student } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", studentId)
    .maybeSingle();

  // 채점되기 전이면 안내만
  const isGraded = assignment.status === "graded";

  const [{ data: questions }, { data: answers }, { data: unitStats }, { data: totalScore }] =
    await Promise.all([
      supabase
        .from("test_questions")
        .select("question_no, correct_answer, unit_major, unit_minor, points, difficulty")
        .eq("test_sheet_id", id)
        .order("question_no"),
      supabase
        .from("student_answers")
        .select("question_no, selected, is_correct")
        .eq("test_sheet_id", id)
        .eq("student_id", studentId),
      supabase.rpc("test_unit_stats", {
        p_test_sheet_id: id,
        p_student_id: studentId,
      }),
      supabase.rpc("test_total_score", {
        p_test_sheet_id: id,
        p_student_id: studentId,
      }),
    ]);

  const total = (totalScore ?? [])[0];

  // 대단원별 집계 (소단원 합산)
  const majorMap = new Map<string, { total: number; correct: number }>();
  (unitStats ?? []).forEach((u) => {
    const cur = majorMap.get(u.unit_major) ?? { total: 0, correct: 0 };
    cur.total += u.total;
    cur.correct += u.correct;
    majorMap.set(u.unit_major, cur);
  });
  const radarData = Array.from(majorMap.entries()).map(([k, v]) => ({
    unit: k,
    accuracy: v.total === 0 ? 0 : Math.round((v.correct / v.total) * 100),
  }));

  // 소단원별 오답률 막대
  const barData = (unitStats ?? [])
    .filter((u) => u.unit_minor != null && u.unit_minor !== "")
    .map((u) => ({
      label: `${u.unit_major} · ${u.unit_minor}`,
      wrongRate: 100 - Number(u.accuracy),
      total: u.total,
    }))
    .sort((a, b) => b.wrongRate - a.wrongRate)
    .slice(0, 8);

  const answersMap = new Map(
    (answers ?? []).map((a) => [a.question_no, a]),
  );

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <Wordmark size="md" />
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/tests">
              <ChevronLeft className="size-4" />
              시험 목록
            </Link>
          </Button>
        </div>

        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">
            {student?.full_name}
            {sheet.target_school ? ` · ${sheet.target_school}` : ""}
            {sheet.target_grade ? ` ${sheet.target_grade}학년` : ""}
            {sheet.test_date ? ` · 시험일 ${sheet.test_date}` : ""}
          </p>
          <h1 className="font-display text-[34px] leading-tight">
            {sheet.title}
          </h1>
        </div>

        {!isGraded ? (
          <div className="border-hairline rounded-[14px] border bg-surface p-10 text-center">
            <p className="font-display text-2xl">아직 채점 전이에요</p>
            <p className="text-muted-foreground mt-2 text-sm">
              채점이 완료되면 결과 리포트가 여기에 표시돼요.
            </p>
          </div>
        ) : (
          <>
            {/* 점수 요약 */}
            <section className="border-hairline grid gap-4 rounded-[14px] border bg-surface p-7 md:grid-cols-4">
              <ScoreStat
                label="총점"
                value={`${total?.earned_points ?? 0}`}
                suffix={`/ ${total?.total_points ?? 0}점`}
                accent
              />
              <ScoreStat
                label="정답률"
                value={`${total?.score_percent ?? 0}`}
                suffix="%"
              />
              <ScoreStat
                label="맞힌 문항"
                value={`${total?.correct_count ?? 0}`}
                suffix={`/ ${total?.total_questions ?? 0}`}
              />
              <ScoreStat
                label="틀린 문항"
                value={`${(total?.total_questions ?? 0) - (total?.correct_count ?? 0)}`}
                suffix={`/ ${total?.total_questions ?? 0}`}
              />
            </section>

            {/* 차트 */}
            <ReportCharts radarData={radarData} barData={barData} />

            {/* 문항별 정오답 */}
            <section className="border-hairline rounded-[14px] border bg-surface">
              <h2 className="border-hairline border-b px-7 py-4 text-base font-extrabold">
                문항별 정오답
              </h2>
              <div className="grid grid-cols-5 gap-2 p-5 sm:grid-cols-8 md:grid-cols-10">
                {(questions ?? []).map((q) => {
                  const a = answersMap.get(q.question_no);
                  const ok = a?.is_correct === true;
                  const wrong = a && !a.is_correct;
                  return (
                    <div
                      key={q.question_no}
                      className="flex flex-col items-center gap-1"
                    >
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {q.question_no}
                      </span>
                      <div
                        className={
                          "flex size-10 items-center justify-center rounded-md text-base font-bold " +
                          (ok
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : wrong
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground")
                        }
                      >
                        {a?.selected ?? "-"}
                      </div>
                      {wrong && (
                        <span className="text-muted-foreground text-[10px]">
                          정답 {q.correct_answer}
                        </span>
                      )}
                      {ok && (
                        <span className="text-[10px] text-emerald-600">정답</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function ScoreStat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span
          className={
            "font-display text-[40px] leading-none " +
            (accent ? "text-primary" : "")
          }
        >
          {value}
        </span>
        <span className="text-muted-foreground text-sm">{suffix}</span>
      </p>
    </div>
  );
}
