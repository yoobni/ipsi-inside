"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { loginSchema } from "@ipsi/types";
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

  // 반드시 admin role + approved 상태여야 함
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", signIn.user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin" || profile.status !== "approved") {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "관리자 권한이 없는 계정입니다",
    };
  }

  revalidatePath("/", "layout");
  redirect("/members/pending");
}

export async function adminLogoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
