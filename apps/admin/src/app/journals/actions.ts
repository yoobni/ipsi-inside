"use server";

import { revalidatePath } from "next/cache";
import { journalFeedbackSchema } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";
import { nextKstSixAm } from "@/lib/kst";

type Result = { ok: true } | { ok: false; message: string };

async function ensureAdmin(): Promise<{ adminId: string } | { error: Result }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: { ok: false, message: "로그인이 필요합니다" } };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" || profile?.status !== "approved") {
    return { error: { ok: false, message: "권한이 없습니다" } };
  }
  return { adminId: user.id };
}

/**
 * 피드백 저장 (초안 — publish_at 변경 안 함)
 */
export async function saveFeedbackDraftAction(
  journalId: string,
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const parsed = journalFeedbackSchema.safeParse({
    overall_comment: formData.get("overall_comment"),
    better_than_yesterday: formData.get("better_than_yesterday"),
    worse_than_yesterday: formData.get("worse_than_yesterday"),
    must_fix_tomorrow: formData.get("must_fix_tomorrow"),
  });
  if (!parsed.success) {
    return { ok: false, message: "입력 형식 오류" };
  }

  const db = createAdminSupabaseClient();

  // upsert by journal_id (unique)
  const { error } = await db.from("journal_feedbacks").upsert(
    {
      journal_id: journalId,
      overall_comment: parsed.data.overall_comment || null,
      better_than_yesterday: parsed.data.better_than_yesterday || null,
      worse_than_yesterday: parsed.data.worse_than_yesterday || null,
      must_fix_tomorrow: parsed.data.must_fix_tomorrow || null,
      written_by: check.adminId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "journal_id" },
  );

  if (error) return { ok: false, message: error.message };
  revalidatePath("/journals");
  return { ok: true };
}

/**
 * 발행 — 다음 KST 06:00에 학생/학부모에게 공개
 */
export async function publishFeedbackAction(
  journalId: string,
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  // 먼저 저장
  const saveResult = await saveFeedbackDraftAction(journalId, null, formData);
  if (!saveResult.ok) return saveResult;

  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();
  const publishAt = nextKstSixAm();

  const { error } = await db
    .from("journal_feedbacks")
    .update({ publish_at: publishAt.toISOString() })
    .eq("journal_id", journalId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/journals");
  return { ok: true };
}

/**
 * 발행 취소 (publish_at = null)
 */
export async function unpublishFeedbackAction(
  journalId: string,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();
  const { error } = await db
    .from("journal_feedbacks")
    .update({ publish_at: null })
    .eq("journal_id", journalId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/journals");
  return { ok: true };
}
