"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result =
  | { ok: true; attemptId?: string }
  | { ok: false; message: string };

/**
 * 응시 시작 — in_progress 있으면 이어풀기, 없으면 신규 attempt 생성.
 * open_at/due_at, 재응시 정책 검증.
 */
export async function startOrResumeAttemptAction(
  testSheetId: string,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  // 시험지 + 배정 확인
  const { data: sheet } = await supabase
    .from("test_sheets")
    .select("id, open_at, due_at, allow_retake, max_attempts")
    .eq("id", testSheetId)
    .maybeSingle();
  if (!sheet) return { ok: false, message: "시험지를 찾을 수 없어요." };

  const now = new Date();
  if (sheet.open_at && new Date(sheet.open_at) > now)
    return { ok: false, message: "아직 시험이 열리지 않았어요." };
  if (sheet.due_at && new Date(sheet.due_at) < now)
    return { ok: false, message: "시험이 마감됐어요." };

  const { data: assignment } = await supabase
    .from("test_assignments")
    .select("id")
    .eq("test_sheet_id", testSheetId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!assignment)
    return { ok: false, message: "이 시험에 배정되지 않았어요." };

  // 진행 중인 attempt 있는지
  const { data: existing } = await supabase
    .from("test_attempts")
    .select("id, attempt_no")
    .eq("assignment_id", assignment.id)
    .eq("status", "in_progress")
    .maybeSingle();

  if (existing) return { ok: true, attemptId: existing.id };

  // 제출 완료된 응시 횟수 확인
  const { data: submitted } = await supabase
    .from("test_attempts")
    .select("attempt_no")
    .eq("assignment_id", assignment.id)
    .eq("status", "submitted")
    .order("attempt_no", { ascending: false });

  const prevCount = (submitted ?? []).length;
  const maxAttempts = sheet.allow_retake ? sheet.max_attempts ?? null : 1;
  if (maxAttempts != null && prevCount >= maxAttempts) {
    return {
      ok: false,
      message: `재응시 한도(${maxAttempts}회)를 초과했어요.`,
    };
  }

  const attemptNo = (submitted ?? [])[0]?.attempt_no
    ? (submitted![0]!.attempt_no ?? 0) + 1
    : 1;

  const { data: newAttempt, error } = await supabase
    .from("test_attempts")
    .insert({
      assignment_id: assignment.id,
      attempt_no: attemptNo,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (error || !newAttempt) return { ok: false, message: error?.message ?? "응시 시작 실패" };

  return { ok: true, attemptId: newAttempt.id };
}

/**
 * 답안 저장 — 매 선택마다 호출 (auto-save).
 */
export async function saveAnswerAction(
  attemptId: string,
  questionId: string,
  selected: number | null,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("student_answers")
    .upsert(
      {
        attempt_id: attemptId,
        question_id: questionId,
        selected,
      },
      { onConflict: "attempt_id,question_id" },
    );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/**
 * 시험 제출 — status='submitted', score/total_points 계산.
 */
export async function submitAttemptAction(
  attemptId: string,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();

  // 채점 결과 계산
  const { data: rows } = await supabase.rpc("attempt_total_score", {
    p_attempt_id: attemptId,
  });
  const totals = rows?.[0];

  const { error: uErr } = await supabase
    .from("test_attempts")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      score: totals?.earned_points ?? 0,
      total_points: totals?.total_points ?? 0,
    })
    .eq("id", attemptId);
  if (uErr) return { ok: false, message: uErr.message };

  // 시험지 id 찾아서 revalidate
  const { data: att } = await supabase
    .from("test_attempts")
    .select("assignment_id")
    .eq("id", attemptId)
    .maybeSingle();
  if (att) {
    const { data: asg } = await supabase
      .from("test_assignments")
      .select("test_sheet_id")
      .eq("id", att.assignment_id)
      .maybeSingle();
    if (asg) {
      revalidatePath(`/dashboard/tests/${asg.test_sheet_id}`);
    }
  }
  revalidatePath("/dashboard/tests");
  return { ok: true, attemptId };
}
