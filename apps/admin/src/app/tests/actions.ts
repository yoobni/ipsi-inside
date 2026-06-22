"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import {
  assignmentInputSchema,
  testSheetCompositionSchema,
  testSheetInputSchema,
} from "@ipsi/types";

type Result =
  | { ok: true; id?: string; count?: number }
  | { ok: false; message: string };

export async function createTestSheetAction(
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const payloadRaw = fd.get("payload");
  if (typeof payloadRaw !== "string") return { ok: false, message: "payload 누락" };

  let parsed;
  try {
    parsed = testSheetCompositionSchema.parse(JSON.parse(payloadRaw));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "검증 실패" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const { data: sheet, error: sErr } = await supabase
    .from("test_sheets")
    .insert({
      title: parsed.meta.title,
      description: parsed.meta.description ?? null,
      target_school: parsed.meta.target_school ?? null,
      target_grade: parsed.meta.target_grade ?? null,
      open_at: parsed.meta.open_at ?? null,
      due_at: parsed.meta.due_at ?? null,
      allow_retake: parsed.meta.allow_retake,
      max_attempts: parsed.meta.max_attempts ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (sErr || !sheet)
    return { ok: false, message: `시험지 저장 실패: ${sErr?.message ?? ""}` };

  const rows = parsed.question_ids.map((qid, idx) => ({
    test_sheet_id: sheet.id,
    question_id: qid,
    position: idx + 1,
  }));
  const { error: qErr } = await supabase.from("test_sheet_questions").insert(rows);
  if (qErr) {
    await supabase.from("test_sheets").delete().eq("id", sheet.id);
    return { ok: false, message: `문항 매핑 실패: ${qErr.message}` };
  }

  revalidatePath("/tests");
  return { ok: true, id: sheet.id };
}

export async function updateTestSheetAction(
  testSheetId: string,
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const payloadRaw = fd.get("payload");
  if (typeof payloadRaw !== "string") return { ok: false, message: "payload 누락" };

  let parsed;
  try {
    parsed = testSheetCompositionSchema.parse(JSON.parse(payloadRaw));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "검증 실패" };
  }

  const supabase = await createServerSupabaseClient();

  // 응시 시작된 적 있으면 거부
  const { count } = await supabase
    .from("test_attempts")
    .select("id", { count: "exact", head: true })
    .in(
      "assignment_id",
      (
        await supabase
          .from("test_assignments")
          .select("id")
          .eq("test_sheet_id", testSheetId)
      ).data?.map((a) => a.id) ?? [],
    );
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: "학생이 이미 응시를 시작한 시험지는 수정할 수 없어요.",
    };
  }

  const { error: uErr } = await supabase
    .from("test_sheets")
    .update({
      title: parsed.meta.title,
      description: parsed.meta.description ?? null,
      target_school: parsed.meta.target_school ?? null,
      target_grade: parsed.meta.target_grade ?? null,
      open_at: parsed.meta.open_at ?? null,
      due_at: parsed.meta.due_at ?? null,
      allow_retake: parsed.meta.allow_retake,
      max_attempts: parsed.meta.max_attempts ?? null,
    })
    .eq("id", testSheetId);
  if (uErr) return { ok: false, message: friendlyDbError(uErr) };

  // 매핑 전체 교체
  await supabase
    .from("test_sheet_questions")
    .delete()
    .eq("test_sheet_id", testSheetId);

  const rows = parsed.question_ids.map((qid, idx) => ({
    test_sheet_id: testSheetId,
    question_id: qid,
    position: idx + 1,
  }));
  const { error: qErr } = await supabase.from("test_sheet_questions").insert(rows);
  if (qErr) return { ok: false, message: `문항 매핑 실패: ${qErr.message}` };

  revalidatePath("/tests");
  revalidatePath(`/tests/${testSheetId}`);
  return { ok: true, id: testSheetId };
}

export async function duplicateTestSheetAction(
  sourceId: string,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const { data: source } = await supabase
    .from("test_sheets")
    .select(
      "title, description, target_school, target_grade, open_at, due_at, allow_retake, max_attempts",
    )
    .eq("id", sourceId)
    .maybeSingle();
  if (!source) return { ok: false, message: "원본 시험지를 찾을 수 없어요." };

  const { data: copy, error: cErr } = await supabase
    .from("test_sheets")
    .insert({
      title: `${source.title} (복제)`,
      description: source.description,
      target_school: source.target_school,
      target_grade: source.target_grade,
      // 일정은 비움 (복제본 새로 배정될 때 다시 정하라고)
      open_at: null,
      due_at: null,
      allow_retake: source.allow_retake,
      max_attempts: source.max_attempts,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (cErr || !copy) return { ok: false, message: cErr?.message ?? "복제 실패" };

  const { data: tsq } = await supabase
    .from("test_sheet_questions")
    .select("question_id, position")
    .eq("test_sheet_id", sourceId)
    .order("position");

  if ((tsq ?? []).length > 0) {
    const rows = (tsq ?? []).map((r) => ({
      test_sheet_id: copy.id,
      question_id: r.question_id,
      position: r.position,
    }));
    const { error: qErr } = await supabase
      .from("test_sheet_questions")
      .insert(rows);
    if (qErr) {
      await supabase.from("test_sheets").delete().eq("id", copy.id);
      return { ok: false, message: `문항 복제 실패: ${qErr.message}` };
    }
  }

  revalidatePath("/tests");
  return { ok: true, id: copy.id };
}

export async function deleteTestSheetAction(testSheetId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("test_sheets")
    .delete()
    .eq("id", testSheetId);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/tests");
  return { ok: true };
}

/* ─────────────────────────────────────────────────────────────────────────
 * 배정 — 학교 단위 자동 + 개별 학생 추가
 * ───────────────────────────────────────────────────────────────────────── */

export async function assignAction(
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const payloadRaw = fd.get("payload");
  if (typeof payloadRaw !== "string") return { ok: false, message: "payload 누락" };

  let parsed;
  try {
    parsed = assignmentInputSchema.parse(JSON.parse(payloadRaw));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "검증 실패" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  // 학교 단위 → 그 학교 활성 학생 enum
  const targets: { student_id: string; school: string | null }[] = [];

  if ((parsed.schools?.length ?? 0) > 0) {
    const { data: students } = await supabase
      .from("profiles")
      .select("id, school")
      .eq("role", "student")
      .eq("status", "approved")
      .in("school", parsed.schools!);
    (students ?? []).forEach((s) =>
      targets.push({ student_id: s.id, school: s.school }),
    );
  }

  if ((parsed.student_ids?.length ?? 0) > 0) {
    const { data: students } = await supabase
      .from("profiles")
      .select("id, school")
      .in("id", parsed.student_ids!);
    (students ?? []).forEach((s) => {
      if (!targets.find((t) => t.student_id === s.id)) {
        targets.push({ student_id: s.id, school: null });
      }
    });
  }

  if (targets.length === 0)
    return { ok: false, message: "배정 대상 학생이 없어요." };

  const rows = targets.map((t) => ({
    test_sheet_id: parsed.test_sheet_id,
    student_id: t.student_id,
    assigned_by: user.id,
    assigned_by_school: t.school,
  }));

  // upsert — 이미 배정된 학생은 무시
  const { error } = await supabase
    .from("test_assignments")
    .upsert(rows, { onConflict: "test_sheet_id,student_id", ignoreDuplicates: true });
  if (error) return { ok: false, message: friendlyDbError(error) };

  // 알림 — 학생 + 연결된 학부모
  const { data: sheet } = await supabase
    .from("test_sheets")
    .select("title")
    .eq("id", parsed.test_sheet_id)
    .maybeSingle();
  const studentIds = targets.map((t) => t.student_id);
  const { data: parentLinks } = await supabase
    .from("parent_student_links")
    .select("parent_id, student_id")
    .in("student_id", studentIds);

  const notifs: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string | null;
    link: string;
  }> = [];
  studentIds.forEach((sid) => {
    notifs.push({
      user_id: sid,
      type: "test_assigned",
      title: `시험 배정: ${sheet?.title ?? ""}`,
      body: "시험 페이지에서 응시하세요.",
      link: `/dashboard/tests/${parsed.test_sheet_id}`,
    });
  });
  (parentLinks ?? []).forEach((l) => {
    notifs.push({
      user_id: l.parent_id,
      type: "test_assigned",
      title: `자녀에게 시험 배정`,
      body: sheet?.title ?? "",
      link: `/dashboard/tests/${parsed.test_sheet_id}`,
    });
  });
  if (notifs.length > 0) {
    await supabase.from("notifications").insert(notifs);
  }

  revalidatePath(`/tests/${parsed.test_sheet_id}`);
  return { ok: true, count: rows.length };
}

export async function unassignAction(
  testSheetId: string,
  studentId: string,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();

  // 응시 기록 있으면 거부
  const { count } = await supabase
    .from("test_attempts")
    .select("id", { count: "exact", head: true })
    .in(
      "assignment_id",
      (
        await supabase
          .from("test_assignments")
          .select("id")
          .eq("test_sheet_id", testSheetId)
          .eq("student_id", studentId)
      ).data?.map((a) => a.id) ?? [],
    );
  if ((count ?? 0) > 0) {
    return { ok: false, message: "응시 기록이 있는 학생은 배정 해제할 수 없어요." };
  }

  const { error } = await supabase
    .from("test_assignments")
    .delete()
    .eq("test_sheet_id", testSheetId)
    .eq("student_id", studentId);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath(`/tests/${testSheetId}`);
  return { ok: true };
}
