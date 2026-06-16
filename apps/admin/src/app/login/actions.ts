"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { loginSchema } from "@ipsi/types";
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

  const supabase = await createServerSupabaseClient();
  const { data: signIn, error } = await supabase.auth.signInWithPassword(
    parsed.data,
  );
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
