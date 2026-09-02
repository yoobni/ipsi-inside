"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { logAdminAccess } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result = { ok: true } | { ok: false; message: string };

/**
 * 점검 완료 기록.
 *
 * 고시가 요구하는 건 접속기록을 **보관**하는 것과 **월 1회 이상 점검**하는 것
 * 두 가지다. 테이블만 있고 점검을 안 하면 절반만 채운 셈이라, 점검했다는
 * 사실 자체도 같은 테이블에 남긴다(감사받을 때 내놓을 게 이것뿐이다).
 */
export async function markReviewedAction(note?: string): Promise<Result> {
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
  if (profile?.role !== "admin" || profile?.status !== "approved") {
    return { ok: false, message: "권한이 없습니다" };
  }

  await logAdminAccess({
    actorId: user.id,
    action: "audit.review",
    detail: note && note.trim() ? { note: note.trim() } : null,
    headers: await headers(),
  });

  revalidatePath("/access-logs");
  return { ok: true };
}
