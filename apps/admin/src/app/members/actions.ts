"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";

type Result = { ok: true } | { ok: false; message: string };

async function ensureAdmin(): Promise<
  { adminId: string } | { error: Result }
> {
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

export async function suspendMemberAction(profileId: string): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();
  const { error } = await db
    .from("profiles")
    .update({ status: "suspended" })
    .eq("id", profileId)
    .neq("role", "admin");

  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/members");
  return { ok: true };
}

export async function unsuspendMemberAction(
  profileId: string,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();
  const { error } = await db
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", profileId);

  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/members");
  return { ok: true };
}

export async function addParentStudentLinkAction(
  parentId: string,
  studentId: string,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();

  const { data: rows } = await db
    .from("profiles")
    .select("id, role, status")
    .in("id", [parentId, studentId]);
  const parent = rows?.find((r) => r.id === parentId);
  const student = rows?.find((r) => r.id === studentId);
  if (!parent || parent.role !== "parent") {
    return { ok: false, message: "학부모 계정이 아닙니다" };
  }
  if (!student || student.role !== "student") {
    return { ok: false, message: "학생 계정이 아닙니다" };
  }

  const { error } = await db
    .from("parent_student_links")
    .insert({ parent_id: parentId, student_id: studentId });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "이미 연결된 학생입니다" };
    }
    return { ok: false, message: friendlyDbError(error) };
  }

  revalidatePath("/members");
  return { ok: true };
}

export async function removeParentStudentLinkAction(
  parentId: string,
  studentId: string,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();
  const { error } = await db
    .from("parent_student_links")
    .delete()
    .eq("parent_id", parentId)
    .eq("student_id", studentId);

  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/members");
  return { ok: true };
}
