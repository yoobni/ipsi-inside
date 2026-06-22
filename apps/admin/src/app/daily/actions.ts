"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";

type Result = { ok: true } | { ok: false; message: string };

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

type Attendance = "present" | "late" | "absent" | null;
type HomeworkGrade = "S" | "A" | "B" | "F" | null;

type UpsertFields = {
  studentId: string;
  date: string;
  attendance?: Attendance;
  homework_grade?: HomeworkGrade;
  test_score?: number | null;
  note?: string | null;
};

export async function upsertDailyAction(fields: UpsertFields): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();

  // 부분 업데이트: 기존 row 있으면 머지, 없으면 새로 만들기
  const { data: existing } = await db
    .from("daily_attendance")
    .select(
      "id, attendance, homework_grade, test_score, note",
    )
    .eq("student_id", fields.studentId)
    .eq("date", fields.date)
    .maybeSingle();

  const payload = {
    student_id: fields.studentId,
    date: fields.date,
    attendance:
      fields.attendance !== undefined ? fields.attendance : existing?.attendance ?? null,
    homework_grade:
      fields.homework_grade !== undefined
        ? fields.homework_grade
        : existing?.homework_grade ?? null,
    test_score:
      fields.test_score !== undefined ? fields.test_score : existing?.test_score ?? null,
    note: fields.note !== undefined ? fields.note : existing?.note ?? null,
    updated_by: check.adminId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from("daily_attendance")
    .upsert(payload, { onConflict: "student_id,date" });
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/daily");
  return { ok: true };
}

/**
 * 일괄 마킹 — 여러 학생에게 동일한 출석/과제 값 적용.
 * studentIds가 비어 있으면 noop.
 */
export async function bulkMarkDailyAction(params: {
  date: string;
  studentIds: string[];
  attendance?: Attendance;
  homework_grade?: HomeworkGrade;
}): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  if (params.studentIds.length === 0)
    return { ok: false, message: "대상 학생이 없어요." };
  if (
    params.attendance === undefined &&
    params.homework_grade === undefined
  )
    return { ok: false, message: "적용할 값이 없어요." };

  const db = createAdminSupabaseClient();

  // 기존 row 일괄 조회
  const { data: existing } = await db
    .from("daily_attendance")
    .select("student_id, attendance, homework_grade, test_score, note")
    .in("student_id", params.studentIds)
    .eq("date", params.date);

  const exMap = new Map(
    (existing ?? []).map((r) => [r.student_id, r] as const),
  );

  const nowIso = new Date().toISOString();
  const rows = params.studentIds.map((sid) => {
    const ex = exMap.get(sid);
    return {
      student_id: sid,
      date: params.date,
      attendance:
        params.attendance !== undefined
          ? params.attendance
          : ex?.attendance ?? null,
      homework_grade:
        params.homework_grade !== undefined
          ? params.homework_grade
          : ex?.homework_grade ?? null,
      test_score: ex?.test_score ?? null,
      note: ex?.note ?? null,
      updated_by: check.adminId,
      updated_at: nowIso,
    };
  });

  const { error } = await db
    .from("daily_attendance")
    .upsert(rows, { onConflict: "student_id,date" });
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/daily");
  return { ok: true };
}
