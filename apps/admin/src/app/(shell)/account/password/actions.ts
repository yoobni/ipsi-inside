"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { firstAllowedHref, passwordSchema } from "@ipsi/types";
import { friendlyDbError } from "@ipsi/lib";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";
import { ensureStaff } from "@/lib/auth";

type Result = { ok: true } | { ok: false; message: string };

/**
 * 교직원 본인 비밀번호 변경.
 *
 * 원장이 조교 계정을 만들거나 재발급하면 임시 비밀번호 + must_change_password가
 * 켜지고, 여기서 새로 정할 때까지 proxy가 다른 화면을 막는다(웹의 학생 잠금과
 * 같은 규칙). 원장이 아는 비밀번호가 계정에 남아 있지 않게 하려는 것.
 */
export async function changeStaffPasswordAction(
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!current) return { ok: false, message: "지금 쓰는 비밀번호를 입력해주세요" };
  const parsedNext = passwordSchema.safeParse(next);
  if (!parsedNext.success) {
    return {
      ok: false,
      message: parsedNext.error.issues[0]?.message ?? "비밀번호를 확인해주세요",
    };
  }
  if (next !== confirm) return { ok: false, message: "새 비밀번호가 서로 달라요" };
  if (next === current) {
    return { ok: false, message: "지금 쓰는 비밀번호와 다르게 정해주세요" };
  }

  const check = await ensureStaff();
  if ("error" in check) return check.error;
  const { supabase, staff } = check;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, message: "로그인이 필요합니다" };

  // 현재 비밀번호 확인 — 세션만 믿으면 남이 켜둔 브라우저에서 바꿀 수 있다
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (signInError) return { ok: false, message: "지금 쓰는 비밀번호가 맞지 않아요" };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false, message: error.message };

  // 잠금 해제 — must_change_password는 컬럼 GRANT 밖이라 service_role로 쓴다.
  const { error: flagError } = await createAdminSupabaseClient()
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", staff.id);
  if (flagError) return { ok: false, message: friendlyDbError(flagError) };

  revalidatePath("/", "layout");
  redirect(firstAllowedHref(staff.level, staff.permissions));
}
