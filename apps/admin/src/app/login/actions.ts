"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { firstAllowedHref, loginSchema, type PermissionKey } from "@ipsi/types";
import {
  checkRateLimit,
  extractClientIp,
  pruneRateLimitBuckets,
  verifyTurnstile,
} from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function adminLoginAction(
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

  // 원장 계정은 모든 학생의 개인정보에 닿는다 — 무차별 대입을 가장 먼저 막아야
  // 할 문이다. 학생/학부모 로그인(web)보다 한도를 좁게 잡았다.
  const h = await headers();
  const rl = await checkRateLimit({
    name: "admin-login",
    key: `${extractClientIp(h)}:${parsed.data.email}`,
    limit: 5,
    windowSec: 600,
  });
  if (!rl.ok) {
    return {
      ok: false,
      message: `로그인 시도가 많았어요. ${rl.retryAfterSec}초 후 다시 시도해주세요.`,
    };
  }
  // 만료 버킷 청소를 크론 대신 여기 얹는다 (실패해도 무시)
  void pruneRateLimitBuckets();

  const captcha = await verifyTurnstile(
    formData.get("cf-turnstile-response") as string | null,
    extractClientIp(h),
  );
  if (!captcha.ok) return { ok: false, message: captcha.message };

  const supabase = await createServerSupabaseClient();
  const { data: signIn, error } = await supabase.auth.signInWithPassword({
    ...parsed.data,
    options: { captchaToken: (formData.get("cf-turnstile-response") as string) || undefined },
  });
  if (error || !signIn.user) {
    return { ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다" };
  }

  // 반드시 admin role + approved 상태 + 급(owner|assistant)이 있어야 함
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, admin_level")
    .eq("id", signIn.user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.role !== "admin" ||
    profile.status !== "approved" ||
    !profile.admin_level
  ) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "관리자 권한이 없는 계정입니다",
    };
  }

  // 원장은 가입 승인으로, 조교는 허용된 첫 메뉴로. (임시 비밀번호면 proxy가
  // /account/password 로 돌린다)
  let permissions: PermissionKey[] = [];
  if (profile.admin_level === "assistant") {
    const { data: settings } = await supabase
      .from("staff_settings")
      .select("permissions")
      .eq("staff_id", signIn.user.id)
      .maybeSingle();
    permissions = (settings?.permissions ?? []) as PermissionKey[];
  }

  revalidatePath("/", "layout");
  redirect(firstAllowedHref(profile.admin_level, permissions));
}

export async function adminLogoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
