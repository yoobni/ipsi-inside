"use server";

import { revalidatePath } from "next/cache";
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
  if (error) return { ok: false, message: error.message };

  revalidatePath("/daily");
  return { ok: true };
}
