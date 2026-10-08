"use server";

import { revalidatePath } from "next/cache";
import { rankingSettingsInputSchema } from "@ipsi/types";
import { friendlyDbError } from "@ipsi/lib";
import { ensureOwner } from "@/lib/auth";

type Result = { ok: true } | { ok: false; message: string };

/**
 * TOP3 설정 저장 — 실명 공개 여부는 개인정보 설정이라 원장만.
 * 세션 클라이언트로 쓴다(ranking_settings RLS가 is_owner()).
 */
export async function updateRankingSettingsAction(
  _prev: Result | null,
  fd: FormData,
): Promise<Result> {
  const check = await ensureOwner();
  if ("error" in check) return check.error;

  const sheet = (fd.get("featuredTestSheetId") as string) || "";
  const parsed = rankingSettingsInputSchema.safeParse({
    nameDisplay: fd.get("nameDisplay"),
    scope: fd.get("scope"),
    showHomework: fd.get("showHomework") === "on",
    showAttendance: fd.get("showAttendance") === "on",
    showGrowth: fd.get("showGrowth") === "on",
    showTest: fd.get("showTest") === "on",
    featuredTestSheetId: sheet === "" || sheet === "__auto__" ? null : sheet,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  }
  const d = parsed.data;

  const { error } = await check.supabase
    .from("ranking_settings")
    .update({
      name_display: d.nameDisplay,
      scope: d.scope,
      show_homework: d.showHomework,
      show_attendance: d.showAttendance,
      show_growth: d.showGrowth,
      show_test: d.showTest,
      featured_test_sheet_id: d.featuredTestSheetId,
      updated_by: check.adminId,
    })
    .eq("id", 1);
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/ranking");
  return { ok: true };
}
