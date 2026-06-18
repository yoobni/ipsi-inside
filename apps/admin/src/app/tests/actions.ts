"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  studentAnswersInputSchema,
  testSheetWithQuestionsSchema,
} from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

async function ensureAdmin(): Promise<{ adminId: string } | { error: Result }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: { ok: false, message: "로그인이 필요합니다" } };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" || profile?.status !== "approved") {
    return { error: { ok: false, message: "권한이 없습니다" } };
  }
  return { adminId: user.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// 시험지 생성 (메타 + 문항 일괄)
// ─────────────────────────────────────────────────────────────────────────────
export async function createTestSheetAction(
  _prev: Result<{ id: string }> | null,
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const payloadRaw = formData.get("payload");
  if (typeof payloadRaw !== "string") {
    return { ok: false, message: "잘못된 요청" };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(payloadRaw);
  } catch {
    return { ok: false, message: "데이터 형식 오류" };
  }
  const parsed = testSheetWithQuestionsSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      ok: false,
      message: "입력값을 확인해주세요",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const db = createAdminSupabaseClient();
  const meta = parsed.data.meta;
  const { data: sheet, error: sheetErr } = await db
    .from("test_sheets")
    .insert({
      title: meta.title,
      target_school: meta.targetSchool ?? null,
      target_grade: meta.targetGrade ?? null,
      test_date: meta.testDate ?? null,
      created_by: check.adminId,
    })
    .select("id")
    .single();

  if (sheetErr || !sheet) {
    return { ok: false, message: sheetErr?.message ?? "시험지 생성 실패" };
  }

  const rows = parsed.data.questions.map((q) => ({
    test_sheet_id: sheet.id,
    question_no: q.question_no,
    correct_answer: q.correct_answer,
    unit_major: q.unit_major,
    unit_minor: q.unit_minor ?? null,
    difficulty: q.difficulty ?? null,
    points: q.points,
  }));

  const { error: qErr } = await db.from("test_questions").insert(rows);
  if (qErr) {
    await db.from("test_sheets").delete().eq("id", sheet.id);
    return { ok: false, message: `문항 저장 실패: ${qErr.message}` };
  }

  revalidatePath("/tests");
  redirect(`/tests/${sheet.id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 시험지 수정 (메타 + 문항 — 전체 교체 방식, 답안이 있으면 차단)
// ─────────────────────────────────────────────────────────────────────────────
export async function updateTestSheetAction(
  testSheetId: string,
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const payloadRaw = formData.get("payload");
  if (typeof payloadRaw !== "string") {
    return { ok: false, message: "잘못된 요청" };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(payloadRaw);
  } catch {
    return { ok: false, message: "데이터 형식 오류" };
  }
  const parsed = testSheetWithQuestionsSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      ok: false,
      message: "입력값을 확인해주세요",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const db = createAdminSupabaseClient();

  // 답안이 이미 입력된 시험지는 수정 차단 (채점 데이터 보존)
  const { count } = await db
    .from("student_answers")
    .select("id", { count: "exact", head: true })
    .eq("test_sheet_id", testSheetId);
  if (count && count > 0) {
    return {
      ok: false,
      message: "이미 학생 답안이 입력된 시험지는 수정할 수 없어요. 새 시험지로 만들어주세요.",
    };
  }

  const meta = parsed.data.meta;
  const { error: metaErr } = await db
    .from("test_sheets")
    .update({
      title: meta.title,
      target_school: meta.targetSchool ?? null,
      target_grade: meta.targetGrade ?? null,
      test_date: meta.testDate ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", testSheetId);

  if (metaErr) {
    return { ok: false, message: metaErr.message };
  }

  // 문항 전체 교체
  await db.from("test_questions").delete().eq("test_sheet_id", testSheetId);
  const rows = parsed.data.questions.map((q) => ({
    test_sheet_id: testSheetId,
    question_no: q.question_no,
    correct_answer: q.correct_answer,
    unit_major: q.unit_major,
    unit_minor: q.unit_minor ?? null,
    difficulty: q.difficulty ?? null,
    points: q.points,
  }));
  const { error: qErr } = await db.from("test_questions").insert(rows);
  if (qErr) {
    return { ok: false, message: `문항 저장 실패: ${qErr.message}` };
  }

  revalidatePath("/tests");
  revalidatePath(`/tests/${testSheetId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 시험지 삭제
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteTestSheetAction(testSheetId: string): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();
  const { error } = await db.from("test_sheets").delete().eq("id", testSheetId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/tests");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 학생 배정 (다중)
// ─────────────────────────────────────────────────────────────────────────────
export async function assignStudentsAction(
  testSheetId: string,
  studentIds: string[],
): Promise<Result<{ added: number }>> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;
  if (studentIds.length === 0) {
    return { ok: false, message: "학생을 선택해주세요" };
  }

  const db = createAdminSupabaseClient();
  const rows = studentIds.map((sid) => ({
    test_sheet_id: testSheetId,
    student_id: sid,
    assigned_by: check.adminId,
  }));

  // 기존 배정 있는 것 무시, 새로운 것만
  const { data, error } = await db
    .from("test_assignments")
    .upsert(rows, { onConflict: "test_sheet_id,student_id", ignoreDuplicates: true })
    .select("id");

  if (error) return { ok: false, message: error.message };
  revalidatePath(`/tests/${testSheetId}`);
  return { ok: true, data: { added: data?.length ?? 0 } };
}

export async function unassignStudentAction(
  testSheetId: string,
  studentId: string,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();

  // 답안 있으면 차단
  const { count } = await db
    .from("student_answers")
    .select("id", { count: "exact", head: true })
    .eq("test_sheet_id", testSheetId)
    .eq("student_id", studentId);
  if (count && count > 0) {
    return {
      ok: false,
      message: "이미 답안이 입력된 학생은 배정 해제할 수 없어요.",
    };
  }

  const { error } = await db
    .from("test_assignments")
    .delete()
    .eq("test_sheet_id", testSheetId)
    .eq("student_id", studentId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/tests/${testSheetId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 학생 답안 일괄 저장 (자동 채점은 DB 트리거가 처리)
// ─────────────────────────────────────────────────────────────────────────────
export async function saveStudentAnswersAction(
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const payloadRaw = formData.get("payload");
  if (typeof payloadRaw !== "string") {
    return { ok: false, message: "잘못된 요청" };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(payloadRaw);
  } catch {
    return { ok: false, message: "데이터 형식 오류" };
  }
  const parsed = studentAnswersInputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      ok: false,
      message: "입력값을 확인해주세요",
    };
  }

  const { testSheetId, studentId, answers } = parsed.data;
  const db = createAdminSupabaseClient();

  // 배정 확인
  const { data: assn } = await db
    .from("test_assignments")
    .select("id")
    .eq("test_sheet_id", testSheetId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!assn) {
    return { ok: false, message: "배정되지 않은 학생입니다" };
  }

  // 기존 답안 삭제 후 새로 삽입 (간단 + 트리거가 채점)
  await db
    .from("student_answers")
    .delete()
    .eq("test_sheet_id", testSheetId)
    .eq("student_id", studentId);

  const rows = answers.map((a) => ({
    test_sheet_id: testSheetId,
    student_id: studentId,
    question_no: a.question_no,
    selected: a.selected,
    marked_by: check.adminId,
  }));

  if (rows.length > 0) {
    const { error } = await db.from("student_answers").insert(rows);
    if (error) {
      return { ok: false, message: `답안 저장 실패: ${error.message}` };
    }
  }

  // assignment 상태 graded로 업데이트
  await db
    .from("test_assignments")
    .update({ status: "graded" })
    .eq("test_sheet_id", testSheetId)
    .eq("student_id", studentId);

  revalidatePath(`/tests/${testSheetId}`);
  revalidatePath(`/tests/${testSheetId}/grade`);
  return { ok: true };
}
