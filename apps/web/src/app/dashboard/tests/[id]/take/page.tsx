import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import type { QuestionChoice } from "@ipsi/types";
import { submitAttemptAction } from "../../actions";
import { ExamRunner, type ExamQuestion } from "./exam-runner";

export const dynamic = "force-dynamic";

export default async function TakePage({
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
  if (state.kind !== "ok" || state.status !== "approved") redirect("/pending");
  if (state.role !== "student") redirect("/dashboard");

  // 응시 세션 검증
  const { data: attempt } = await supabase
    .from("test_attempts")
    .select(
      "id, status, attempt_no, assignment_id, test_assignments!inner(test_sheet_id, student_id)",
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) notFound();

  const asg = Array.isArray(attempt.test_assignments)
    ? attempt.test_assignments[0]
    : attempt.test_assignments;
  if (!asg || asg.student_id !== state.userId || asg.test_sheet_id !== id) {
    redirect(`/dashboard/tests/${id}`);
  }
  if (attempt.status === "submitted") {
    redirect(`/dashboard/tests/${id}/result?attempt=${attemptId}`);
  }

  // 본인 응시 세션 확인(위) 뒤에만 띄운다. 시험지·문항·기존 답안은 서로
  // 독립이라 한 번에 보내고, 마감으로 자동 제출되면 문항·답안은 그냥 버려진다.
  const [{ data: sheet }, { data: tsq }, { data: answers }] = await Promise.all([
    supabase
      .from("test_sheets")
      .select("id, title, due_at")
      .eq("id", id)
      .maybeSingle(),
    // 시험지 → 문항 (지문 포함)
    supabase
      .from("test_sheet_questions")
      .select(
        "position, question_id, questions(id, passage_id, position_in_passage, stem, supplementary, choices, points, passages(id, title, content))",
      )
      .eq("test_sheet_id", id)
      .order("position"),
    // 기존 답안
    supabase
      .from("student_answers")
      .select("question_id, selected")
      .eq("attempt_id", attemptId),
  ]);
  if (!sheet) notFound();

  // 마감 지났는데 아직 진행 중이면 자동 제출하고 결과로
  if (sheet.due_at && new Date(sheet.due_at) < new Date()) {
    await submitAttemptAction(attemptId);
    redirect(`/dashboard/tests/${id}/result?attempt=${attemptId}`);
  }

  type ChoiceJson = QuestionChoice[];
  const questions: ExamQuestion[] = (tsq ?? [])
    .map((r) => {
      const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
      if (!q) return null;
      const passage = Array.isArray(q.passages) ? q.passages[0] : q.passages;
      return {
        position: r.position,
        question_id: q.id,
        passage: passage
          ? { id: passage.id, title: passage.title, content: passage.content }
          : null,
        position_in_passage: q.position_in_passage,
        stem: q.stem,
        supplementary: q.supplementary,
        choices: q.choices as ChoiceJson,
        points: q.points,
      };
    })
    .filter((x): x is ExamQuestion => x !== null);

  const existingAnswers: Record<string, number | null> = {};
  (answers ?? []).forEach((a) => {
    existingAnswers[a.question_id] = a.selected;
  });

  return (
    <ExamRunner
      attemptId={attemptId}
      testSheetId={id}
      title={sheet.title}
      dueAt={sheet.due_at}
      questions={questions}
      initialAnswers={existingAnswers}
    />
  );
}
