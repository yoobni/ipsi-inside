"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result = { ok: true } | { ok: false; message: string };

const uuid = z.string().uuid();

/**
 * 숙제 완료 체크/해제 — 세션 클라이언트로. "학생 본인 · 배부받은 회차의 숙제 항목"은 RLS가 강제한다.
 */
export async function toggleHomeworkAction(itemId: string, done: boolean): Promise<Result> {
  if (!uuid.safeParse(itemId).success) return { ok: false, message: "잘못된 요청이에요" };
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다" };

  const { error } = done
    ? await supabase
        .from("course_homework_checks")
        .upsert({ item_id: itemId, student_id: user.id }, { onConflict: "item_id,student_id", ignoreDuplicates: true })
    : await supabase.from("course_homework_checks").delete().eq("item_id", itemId).eq("student_id", user.id);
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/dashboard/class");
  return { ok: true };
}
