import { z } from 'zod';

/**
 * 누적 취약점(student_mastery) · 보충 세트. SQL이 기준, 여기는 파싱·임계값.
 * total/correct = 최근 180일, recent_* = 최근 90일.
 */

/** 취약으로 꼽으려면 180일 동안 최소 이만큼 풀었어야 */
export const MASTERY_MIN_TOTAL = 8;
/** 이 정답률(%) 미만이면 취약 */
export const MASTERY_WEAK_BELOW = 65;
/** 보충 세트 기본 크기 / 하루 상한(SQL 과 같은 값 — SQL 이 기준) */
export const PRACTICE_SET_SIZE = 10;
export const PRACTICE_DAILY_LIMIT = 2;
export const PRACTICE_MIN_QUESTIONS = 3;

export const PRACTICE_TAG_KIND = ['type', 'work', 'concept'] as const;
export type PracticeTagKind = (typeof PRACTICE_TAG_KIND)[number];
export const PRACTICE_TAG_KIND_LABEL: Record<PracticeTagKind, string> = {
  type: '유형',
  work: '작품',
  concept: '개념',
};

const bucket = z.object({
  total: z.number(),
  correct: z.number(),
  recent_total: z.number(),
  recent_correct: z.number(),
});
export const masteryTagSchema = bucket.extend({
  id: z.string(),
  label: z.string(),
  area: z.string().nullable(),
});
export type MasteryTag = z.infer<typeof masteryTagSchema>;

export const studentMasterySchema = z.object({
  student_id: z.string().uuid(),
  window_days: z.number(),
  recent_days: z.number(),
  untyped_questions: z.number(),
  by_type: z.array(masteryTagSchema),
  by_work: z.array(masteryTagSchema),
  by_concept: z.array(masteryTagSchema),
  by_area: z.array(bucket.extend({ id: z.string() })),
});
export type StudentMastery = z.infer<typeof studentMasterySchema>;

export const createPracticeInputSchema = z.object({
  tagKind: z.enum(PRACTICE_TAG_KIND),
  tagId: z.string().uuid(),
  size: z.number().int().min(PRACTICE_MIN_QUESTIONS).max(20).default(PRACTICE_SET_SIZE),
});
export type CreatePracticeInput = z.infer<typeof createPracticeInputSchema>;
