"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  loginSchema,
  parentSignupSchema,
  studentSignupSchema,
} from "@ipsi/types";
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

  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "student",
    status: "pending",
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    school: parsed.data.school,
    grade: parsed.data.grade,
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

  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "parent",
    status: "pending",
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
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
