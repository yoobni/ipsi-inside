"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@ipsi/lib";
import { z } from "zod";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

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
