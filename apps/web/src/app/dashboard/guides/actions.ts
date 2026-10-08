"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

/** 단계 완료 기록 — RLS: 학생 본인·발행된 가이드만. 이미 있으면 무시. */
export async function completeGuideStepAction(guideId: string, stepId: string): Promise<{ ok: boolean }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("guide_progress")
    .upsert({ guide_id: guideId, step_id: stepId, student_id: user.id }, { onConflict: "step_id,student_id", ignoreDuplicates: true });
  if (error) return { ok: false };
  revalidatePath(`/dashboard/guides/${guideId}`);
  revalidatePath("/dashboard/guides");
  return { ok: true };
}
