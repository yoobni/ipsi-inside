import { z } from 'zod';

/**
 * 조교 업무 대시보드 · 관리 필요 감지(staff_dashboard / student_risk_flags) jsonb 형태.
 * SQL이 기준, 여기는 파싱용.
 */

export const RISK_RULE_KEYS = [
  'journal_streak',
  'homework_streak',
  'test_drop',
  'planner_drop',
  'inactive',
  'absent_streak',
] as const;
export type RiskRuleKey = (typeof RISK_RULE_KEYS)[number];

/** 임계값 단위(설정 폼 라벨용) */
export const RISK_RULE_UNIT: Record<RiskRuleKey, string> = {
  journal_streak: '일 연속',
  homework_streak: '개 연속',
  test_drop: '%p 하락',
  planner_drop: '%p 하락',
  inactive: '일',
  absent_streak: '회 연속',
};

export const riskFlagSchema = z.object({
  key: z.string(),
  label: z.string(),
  detail: z.string(),
});
export const riskStudentSchema = z.object({
  student_id: z.string().uuid(),
  full_name: z.string(),
  flags: z.array(riskFlagSchema),
});
export const riskFlagsSchema = z.array(riskStudentSchema);
export type RiskStudent = z.infer<typeof riskStudentSchema>;

const namedStudent = z.object({ id: z.string().uuid(), name: z.string() });

export const staffDashboardSchema = z.object({
  today: z.string(),
  student_count: z.number(),
  journal_missing: z
    .object({ basis: z.enum(['attendance', 'all']), students: z.array(namedStudent) })
    .nullable(),
  homework_unchecked: z
    .object({ students: z.array(namedStudent.extend({ tasks: z.number() })) })
    .nullable(),
  unmarked_today: z.object({ students: z.array(namedStudent) }).nullable(),
  qna_open: z
    .object({
      count: z.number(),
      items: z.array(namedStudent.extend({ created_at: z.string() })),
    })
    .nullable(),
  password_pending: z.object({ students: z.array(namedStudent) }).nullable(),
  risk: riskFlagsSchema,
});
export type StaffDashboard = z.infer<typeof staffDashboardSchema>;

/** 원장 규칙 설정 폼 — 규칙 6개를 한 번에 저장(벌크) */
export const riskRulesInputSchema = z.object({
  rules: z
    .array(
      z.object({
        key: z.enum(RISK_RULE_KEYS),
        enabled: z.boolean(),
        threshold: z.coerce.number().min(1).max(100),
        lookbackDays: z.coerce.number().int().min(1).max(365),
      }),
    )
    .min(1),
});
export type RiskRulesInput = z.infer<typeof riskRulesInputSchema>;

/** 조치 기록 — 며칠 동안 숨길지 */
export const riskAckInputSchema = z.object({
  studentId: z.string().uuid(),
  ruleKey: z.enum(RISK_RULE_KEYS),
  note: z.string().trim().max(200).nullable().optional(),
  days: z.coerce.number().int().min(1).max(60).default(14),
});
export type RiskAckInput = z.infer<typeof riskAckInputSchema>;
