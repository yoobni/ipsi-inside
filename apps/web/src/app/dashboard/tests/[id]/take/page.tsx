import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import type { QuestionChoice } from "@ipsi/types";
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

  const { data: sheet } = await supabase
    .from("test_sheets")
    .select("id, title, due_at")
    .eq("id", id)
    .maybeSingle();
  if (!sheet) notFound();

  // 시험지 → 문항 (지문 포함)
  const { data: tsq } = await supabase
    .from("test_sheet_questions")
    .select(
      "position, question_id, questions(id, passage_id, position_in_passage, stem, supplementary, choices, points, passages(id, title, content))",
    )
    .eq("test_sheet_id", id)
    .order("position");

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

  // 기존 답안
  const { data: answers } = await supabase
    .from("student_answers")
    .select("question_id, selected")
    .eq("attempt_id", attemptId);

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
