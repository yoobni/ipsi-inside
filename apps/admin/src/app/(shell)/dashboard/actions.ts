"use server";

import { revalidatePath } from "next/cache";
import { riskAckInputSchema, riskRulesInputSchema, type RiskAckInput, type RiskRulesInput } from "@ipsi/types";
import { friendlyDbError } from "@ipsi/lib";
import { ensureOwner, ensureStaff } from "@/lib/auth";
import { todayKst } from "@/lib/kst";

type Result = { ok: true } | { ok: false; message: string };

/**
 * 관리 필요 조치 기록 — "상담했음, N일 동안 숨김". 담당 학생이어야 한다.
 * 세션 클라이언트(RLS: staff_can_access_student).
 */
export async function acknowledgeRiskAction(input: RiskAckInput): Promise<Result> {
  const parsed = riskAckInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const check = await ensureStaff({ studentIds: [parsed.data.studentId] });
  if ("error" in check) return check.error;

  const until = new Date(`${todayKst()}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + parsed.data.days);

  const { error } = await check.supabase.from("risk_acknowledgements").insert({
    student_id: parsed.data.studentId,
    rule_key: parsed.data.ruleKey,
    acked_by: check.adminId,
    note: parsed.data.note || null,
    until: until.toISOString().slice(0, 10),
  });
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/dashboard");
  revalidatePath("/members");
  revalidatePath(`/members/${parsed.data.studentId}`);
  return { ok: true };
}

/** 규칙 6개 일괄 저장 — 원장만 */
export async function updateRiskRulesAction(input: RiskRulesInput): Promise<Result> {
  const check = await ensureOwner();
  if ("error" in check) return check.error;
  const parsed = riskRulesInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };

  for (const r of parsed.data.rules) {
    const { error } = await check.supabase
      .from("risk_rules")
      .update({
        enabled: r.enabled,
        threshold: r.threshold,
        lookback_days: r.lookbackDays,
        updated_by: check.adminId,
      })
      .eq("key", r.key);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/risk-rules");
  return { ok: true };
}
