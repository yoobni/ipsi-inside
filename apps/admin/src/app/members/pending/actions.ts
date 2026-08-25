"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { friendlyDbError, logAdminAccess } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";

type Result = { ok: true } | { ok: false; message: string };

async function ensureAdmin(): Promise<{ adminId: string } | { error: Result }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
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

export async function approveProfileAction(
  profileId: string,
  matchedStudentId?: string | null,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();

  // 학부모인 경우 자녀 학생과 연결
  const { data: target } = await db
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();
  if (!target) return { ok: false, message: "대상을 찾을 수 없습니다" };

  if (target.role === "parent") {
    if (!matchedStudentId) {
      return { ok: false, message: "학부모 승인 시 연결할 학생을 선택해야 합니다" };
    }
    const { error: linkErr } = await db
      .from("parent_student_links")
      .insert({ parent_id: profileId, student_id: matchedStudentId });
    if (linkErr) {
      return { ok: false, message: `학생 연결 실패: ${linkErr.message}` };
    }
    await db
      .from("parent_signup_requests")
      .update({ matched_student_id: matchedStudentId })
      .eq("parent_id", profileId);
  }

  const { error } = await db
    .from("profiles")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: check.adminId,
    })
    .eq("id", profileId);

  if (error) return { ok: false, message: friendlyDbError(error) };

  // 승인은 그 계정이 개인정보에 접근할 수 있게 되는 시점이다.
  // 학부모 승인이면 어느 자녀에 연결했는지가 열람 범위 그 자체라 함께 남긴다.
  await logAdminAccess({
    actorId: check.adminId,
    action: "member.approve",
    targetType: "profile",
    targetId: profileId,
    detail: matchedStudentId ? { matchedStudentId } : null,
    headers: await headers(),
  });

  revalidatePath("/members/pending");
  return { ok: true };
}

export async function rejectProfileAction(profileId: string): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();
  const { error } = await db
    .from("profiles")
    .update({ status: "rejected" })
    .eq("id", profileId);

  if (error) return { ok: false, message: friendlyDbError(error) };

  await logAdminAccess({
    actorId: check.adminId,
    action: "member.reject",
    targetType: "profile",
    targetId: profileId,
    headers: await headers(),
  });

  revalidatePath("/members/pending");
  return { ok: true };
}
