"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@ipsi/lib";
import { z } from "zod";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";

type Result = { ok: true } | { ok: false; message: string };

const studentSchema = z.object({
  full_name: z.string().trim().min(2, "이름을 입력해주세요").max(40),
  phone: z
    .string()
    .trim()
    .regex(/^01[016789][0-9]{7,8}$/, "휴대폰 번호 형식을 확인해주세요"),
  school: z.string().trim().max(40).nullable().optional(),
  grade: z.coerce.number().int().min(1).max(3).nullable().optional(),
});
const parentSchema = z.object({
  full_name: z.string().trim().min(2, "이름을 입력해주세요").max(40),
  phone: z
    .string()
    .trim()
    .regex(/^01[016789][0-9]{7,8}$/, "휴대폰 번호 형식을 확인해주세요"),
});

export async function updateMyProfileAction(
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.status !== "approved") {
    return { ok: false, message: "권한이 없습니다" };
  }

  const phoneRaw = (formData.get("phone") as string) ?? "";
  const phone = phoneRaw.replace(/[^0-9]/g, "");

  if (profile.role === "student") {
    const parsed = studentSchema.safeParse({
      full_name: formData.get("full_name"),
      phone,
      school: (formData.get("school") as string) || null,
      grade: formData.get("grade") || null,
    });
    if (!parsed.success)
      return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        school: parsed.data.school?.toString().trim() || null,
        grade: parsed.data.grade ?? null,
      })
      .eq("id", user.id);
    if (error) return { ok: false, message: friendlyDbError(error) };
  } else if (profile.role === "parent") {
    const parsed = parentSchema.safeParse({
      full_name: formData.get("full_name"),
      phone,
    });
    if (!parsed.success)
      return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
      })
      .eq("id", user.id);
    if (error) return { ok: false, message: friendlyDbError(error) };
  } else {
    return { ok: false, message: "이 페이지는 학생/학부모용입니다" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return { ok: true };
}

/**
 * 회원 탈퇴 — 비밀번호 재확인 후 PII 마스킹 + status=suspended + signOut.
 * 학습 이력은 student_id FK로 유지(익명 처리), 학부모-자녀 링크는 삭제.
 * 동일 이메일 재가입은 운영자가 admin api로 풀어줘야 가능.
 */
export async function withdrawAction(
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { ok: false, message: "비밀번호를 입력해주세요" };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email)
    return { ok: false, message: "로그인이 필요합니다" };

  // 비밀번호 재확인 — signInWithPassword 결과로 검증 (성공 시 세션 갱신)
  const { error: signinErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (signinErr) {
    return { ok: false, message: "비밀번호가 일치하지 않습니다" };
  }

  // admin client로 마스킹 (RLS bypass — 사용자가 본인 status 변경 못 하는 정책 대비)
  const admin = createAdminSupabaseClient();
  const { error: updErr } = await admin
    .from("profiles")
    .update({
      status: "suspended",
      full_name: "(탈퇴회원)",
      phone: "",
      school: null,
      grade: null,
      terms_agreed_at: null,
      privacy_agreed_at: null,
      marketing_agreed_at: null,
    })
    .eq("id", user.id);
  if (updErr) {
    return { ok: false, message: "탈퇴 처리 중 오류가 발생했습니다" };
  }

  // 학생 본인이 작성한 자유서술(학습 일지)은 파기.
  // 텍스트에 PII가 인라인으로 섞일 수 있고, 비워두면 빈 껍데기라 익명 보존 가치가 없음.
  // journal_feedbacks는 journal_id on delete cascade로 함께 삭제됨.
  // 시험 응시 결과·출결 등 정량 학습 이력은 프로필 마스킹으로 익명화되어 그대로 보존됨.
  await admin.from("study_journals").delete().eq("student_id", user.id);

  // 학부모-자녀 링크 정리
  await admin
    .from("parent_student_links")
    .delete()
    .or(`parent_id.eq.${user.id},student_id.eq.${user.id}`);

  // 학부모일 경우 자녀 매칭 요청도 정리
  await admin
    .from("parent_signup_requests")
    .delete()
    .eq("parent_id", user.id);

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?withdrawn=1");
}
