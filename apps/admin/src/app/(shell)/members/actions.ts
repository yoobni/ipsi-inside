"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { friendlyDbError, logAdminAccess } from "@ipsi/lib";
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

/**
 * 임시 비밀번호 발급 — 원장이 직접 재설정해 학생에게 전달하는 경로.
 *
 * 메일 기반 재설정을 쓰지 않는 이유: 이 서비스는 가입 시 이메일을 실제로
 * 검증하지 않는다(`email_confirm: true`로 자동 확인). 오타 주소를 적은 학생은
 * 메일을 영원히 못 받아 계정이 잠긴다. 원장이 모든 계정을 승인하는 폐쇄형이라
 * 본인 확인은 대면·전화로 되므로, 원장이 발급하는 쪽이 확실하다.
 *
 * 발급한 비밀번호는 원장도 알게 되므로 must_change_password를 세워
 * 학생이 직접 바꿀 때까지 다른 화면을 못 쓰게 막는다.
 */
export async function issueTempPasswordAction(
  profileId: string,
): Promise<{ ok: true; tempPassword: string } | { ok: false; message: string }> {
  const check = await ensureAdmin();
  if ("error" in check) {
    // ensureAdmin의 Result는 성공 변형도 포함해서 그대로 반환하면 좁혀지지 않는다
    return {
      ok: false,
      message:
        "message" in check.error ? check.error.message : "권한이 없습니다",
    };
  }

  const db = createAdminSupabaseClient();

  const { data: target } = await db
    .from("profiles")
    .select("id, role, status")
    .eq("id", profileId)
    .maybeSingle();
  if (!target) return { ok: false, message: "회원을 찾을 수 없습니다" };
  if (target.role === "admin") {
    // 원장 계정까지 여기서 바꾸면 실수 한 번에 어드민이 잠긴다
    return { ok: false, message: "관리자 계정은 이 화면에서 재설정할 수 없습니다" };
  }

  const tempPassword = generateTempPassword();

  const { error: authError } = await db.auth.admin.updateUserById(profileId, {
    password: tempPassword,
  });
  if (authError) {
    return { ok: false, message: authError.message };
  }

  const { error } = await db
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", profileId);
  if (error) return { ok: false, message: friendlyDbError(error) };

  // 남의 계정 비밀번호를 바꾸는 일이다 — 접속기록에 반드시 남는다.
  await logAdminAccess({
    actorId: check.adminId,
    action: "password.issue",
    targetType: "profile",
    targetId: profileId,
    headers: await headers(),
  });

  revalidatePath("/members");
  revalidatePath(`/members/${profileId}`);
  return { ok: true, tempPassword };
}

/**
 * 임시 비밀번호 생성. 원장이 구두나 문자로 전달하므로 헷갈리는 글자
 * (0/O, 1/l/I)를 빼고, 읽어주기 쉬운 10자로 만든다.
 */
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
