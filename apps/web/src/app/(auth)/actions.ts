"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  loginSchema,
  parentSignupSchema,
  studentSignupSchema,
} from "@ipsi/types";
import { checkRateLimit, extractClientIp } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";

type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "입력값을 확인해주세요",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // TODO: rate limit — 운영 전 실제 구현 연결 ([[packages/lib/src/rate-limit.ts]])
  const h = await headers();
  const rl = await checkRateLimit({
    name: "login",
    key: `${extractClientIp(h)}:${parsed.data.email}`,
    limit: 5,
    windowSec: 300,
  });
  if (!rl.ok) {
    return {
      ok: false,
      message: `잠시 후 다시 시도해주세요 (${rl.retryAfterSec}초)`,
    };
  }

  // 로그인 화면에서 고른 역할 (학생/학부모) — 계정 역할과 다르면 막아 문을 구분
  const intendedRole =
    formData.get("role") === "parent" ? "parent" : "student";

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다" };
  }

  // admin 계정이 web으로 로그인한 경우 차단
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "admin") {
      await supabase.auth.signOut();
      return {
        ok: false,
        message: "관리자 계정은 어드민 페이지에서 로그인해주세요",
      };
    }
    // 학생/학부모 문을 잘못 고른 경우 안내 후 차단
    if (
      (profile?.role === "student" || profile?.role === "parent") &&
      profile.role !== intendedRole
    ) {
      await supabase.auth.signOut();
      const label = profile.role === "student" ? "학생" : "학부모";
      return {
        ok: false,
        message: `이 계정은 ${label} 계정이에요. ${label} 로그인으로 다시 시도해주세요.`,
      };
    }
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function studentSignupAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    role: "student" as const,
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    school: formData.get("school"),
    grade: formData.get("grade"),
  };
  const parsed = studentSignupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "입력값을 확인해주세요",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const consent = readConsent(formData);
  if (consent.error) return consent.error;

  // TODO: rate limit — 가입 폭주 방지
  const h = await headers();
  const rl = await checkRateLimit({
    name: "signup",
    key: extractClientIp(h),
    limit: 3,
    windowSec: 3600,
  });
  if (!rl.ok) {
    return {
      ok: false,
      message: `잠시 후 다시 시도해주세요 (${rl.retryAfterSec}초)`,
    };
  }

  const admin = createAdminSupabaseClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    const message = createErr?.message?.includes("already")
      ? "이미 가입된 이메일입니다"
      : "가입 중 오류가 발생했습니다";
    return { ok: false, message };
  }

  const nowIso = new Date().toISOString();
  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "student",
    status: "pending",
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    school: parsed.data.school,
    grade: parsed.data.grade,
    terms_agreed_at: nowIso,
    privacy_agreed_at: nowIso,
    marketing_agreed_at: consent.marketing ? nowIso : null,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, message: "가입 정보 저장 중 오류가 발생했습니다" };
  }

  // 가입 후 자동 로그인
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  revalidatePath("/", "layout");
  redirect("/pending");
}

export async function parentSignupAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    role: "parent" as const,
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    studentFullName: formData.get("studentFullName"),
    studentPhone: formData.get("studentPhone"),
  };
  const parsed = parentSignupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "입력값을 확인해주세요",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const consent = readConsent(formData);
  if (consent.error) return consent.error;

  // TODO: rate limit — 가입 폭주 방지
  const h = await headers();
  const rl = await checkRateLimit({
    name: "signup",
    key: extractClientIp(h),
    limit: 3,
    windowSec: 3600,
  });
  if (!rl.ok) {
    return {
      ok: false,
      message: `잠시 후 다시 시도해주세요 (${rl.retryAfterSec}초)`,
    };
  }

  const admin = createAdminSupabaseClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    const message = createErr?.message?.includes("already")
      ? "이미 가입된 이메일입니다"
      : "가입 중 오류가 발생했습니다";
    return { ok: false, message };
  }

  const nowIso = new Date().toISOString();
  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "parent",
    status: "pending",
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    terms_agreed_at: nowIso,
    privacy_agreed_at: nowIso,
    marketing_agreed_at: consent.marketing ? nowIso : null,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, message: "가입 정보 저장 중 오류가 발생했습니다" };
  }

  // 어드민이 매칭할 수 있게 자녀 정보 보관
  await admin.from("parent_signup_requests").insert({
    parent_id: created.user.id,
    student_full_name: parsed.data.studentFullName,
    student_phone: parsed.data.studentPhone,
  });

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  revalidatePath("/", "layout");
  redirect("/pending");
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * 비밀번호 재설정 이메일 발송.
 * 보안상 가입 여부를 노출하지 않기 위해 결과는 항상 ok=true (Supabase 에러도 무시).
 */
export async function sendPasswordResetAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "이메일을 정확히 입력해주세요" };
  }

  const h = await headers();

  // TODO: rate limit — 메일 폭주/사용자 열거 보조 방어
  const rl = await checkRateLimit({
    name: "password-reset",
    key: email,
    limit: 3,
    windowSec: 3600,
  });
  if (!rl.ok) {
    // 보안상 결과를 동일하게 보이려면 그냥 ok=true로 돌릴 수도 있지만,
    // 실 운영에선 ratelimit 통과 못 한 시점에 메일 발송도 하지 않음.
    return { ok: true };
  }

  const supabase = await createServerSupabaseClient();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (host ? `${proto}://${host}` : "http://localhost:3000");

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // 가입 여부와 무관하게 동일 응답 (사용자 열거 공격 방지)
  return { ok: true };
}

/**
 * 새 비밀번호 설정.
 * /auth/callback에서 recovery code 교환 후 reset-password 페이지로 redirect된 상태.
 * 세션이 있어야 updateUser 가능.
 */
export async function updatePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const fieldErrors: Record<string, string[]> = {};
  if (password.length < 8)
    fieldErrors.password = ["비밀번호는 8자 이상이어야 합니다"];
  else if (!/[A-Za-z]/.test(password))
    fieldErrors.password = ["영문을 포함해야 합니다"];
  else if (!/[0-9]/.test(password))
    fieldErrors.password = ["숫자를 포함해야 합니다"];

  if (password !== passwordConfirm)
    fieldErrors.passwordConfirm = ["비밀번호가 일치하지 않습니다"];

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "입력값을 확인해주세요", fieldErrors };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      message: "재설정 세션이 만료됐어요. 다시 메일 링크를 받아주세요.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      ok: false,
      message: "비밀번호 변경 중 오류가 발생했습니다",
    };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?reset=success");
}

/**
 * 가입 동의 체크박스 검증.
 *  - termsAgreed/privacyAgreed (필수) 미체크 시 fieldErrors 반환
 *  - marketingAgreed (선택) boolean으로 변환
 */
function readConsent(formData: FormData):
  | { error: null; marketing: boolean }
  | {
      error: {
        ok: false;
        message: string;
        fieldErrors: Record<string, string[]>;
      };
      marketing: false;
    } {
  const terms = formData.get("termsAgreed") === "on";
  const privacy = formData.get("privacyAgreed") === "on";
  const marketing = formData.get("marketingAgreed") === "on";

  if (!terms || !privacy) {
    const fieldErrors: Record<string, string[]> = {};
    if (!terms) fieldErrors.termsAgreed = ["이용약관에 동의해주세요"];
    if (!privacy)
      fieldErrors.privacyAgreed = ["개인정보처리방침에 동의해주세요"];
    return {
      error: {
        ok: false,
        message: "필수 약관에 동의해주세요",
        fieldErrors,
      },
      marketing: false,
    };
  }

  return { error: null, marketing };
}
