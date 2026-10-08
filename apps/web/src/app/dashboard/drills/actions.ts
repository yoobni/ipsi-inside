"use server";

import { drillAnswerResultSchema, drillFinishSchema, type DrillAnswerResult, type DrillFinish } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Fail = { ok: false; message: string };

/** RPC 얇은 래퍼 — 권한·채점은 전부 DB 함수 안(SECURITY DEFINER, 본인 응시만). */
export async function startDrillAction(drillId: string): Promise<{ ok: true; attemptId: string } | Fail> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("start_drill_attempt", { p_drill_id: drillId });
  if (error || !data) return { ok: false, message: "훈련을 시작할 수 없어요. 다시 시도해주세요." };
  return { ok: true, attemptId: data };
}

export async function answerDrillAction(
  attemptId: string,
  itemId: string,
  answer: Record<string, unknown>,
  elapsedMs: number | null,
): Promise<{ ok: true; result: DrillAnswerResult } | Fail> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("submit_drill_answer", {
    p_attempt_id: attemptId,
    p_item_id: itemId,
    p_answer: answer as never,
    p_elapsed_ms: elapsedMs,
  });
  const parsed = drillAnswerResultSchema.safeParse(data);
  if (error || !parsed.success) return { ok: false, message: "채점에 실패했어요. 다시 시도해주세요." };
  return { ok: true, result: parsed.data };
}

export async function finishDrillAction(attemptId: string): Promise<{ ok: true; result: DrillFinish } | Fail> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("finish_drill_attempt", { p_attempt_id: attemptId });
  const parsed = drillFinishSchema.safeParse(data);
  if (error || !parsed.success) return { ok: false, message: "결과를 저장하지 못했어요." };
  return { ok: true, result: parsed.data };
}
