import { z } from 'zod';

/**
 * 시험 분석 RPC(attempt_analysis · sheet_choice_distribution) jsonb 형태.
 * SQL이 기준, 여기는 파싱용. 비율은 화면에서 계산한다.
 */

const bucket = z.object({ total: z.number(), correct: z.number() });

export const analysisAreaSchema = bucket.extend({ source: z.string() });
export const analysisTypeSchema = bucket.extend({
  type_id: z.string().uuid().nullable(),
  label: z.string(),
});
export const analysisDifficultySchema = bucket.extend({ difficulty: z.string() });

export const analysisQuestionSchema = z.object({
  position: z.number(),
  question_id: z.string().uuid(),
  passage_title: z.string(),
  position_in_passage: z.number(),
  stem: z.string(),
  supplementary: z.string().nullable(),
  choices: z.array(z.object({ no: z.number(), text: z.string() })),
  correct_answer: z.number(),
  selected: z.number().nullable(),
  is_correct: z.boolean().nullable(),
  points: z.number(),
  type_label: z.string().nullable(),
  difficulty: z.string().nullable(),
  source: z.string(),
  explanation: z.string().nullable(),
});

export const attemptAnalysisSchema = z.object({
  attempt: z.object({
    id: z.string().uuid(),
    attempt_no: z.number(),
    score: z.number(),
    total_points: z.number(),
    submitted_at: z.string(),
    sheet_id: z.string().uuid(),
    sheet_title: z.string(),
    student_id: z.string().uuid(),
  }),
  previous: z
    .object({
      sheet_id: z.string().uuid(),
      title: z.string(),
      date: z.string(),
      score: z.number(),
      total: z.number(),
    })
    .nullable(),
  by_area: z.array(analysisAreaSchema),
  by_type: z.array(analysisTypeSchema),
  by_difficulty: z.array(analysisDifficultySchema),
  questions: z.array(analysisQuestionSchema),
  recent: z.object({
    window_days: z.number(),
    sheets: z.number(),
    by_area: z.array(analysisAreaSchema),
    by_type: z.array(analysisTypeSchema),
  }),
});
export type AttemptAnalysis = z.infer<typeof attemptAnalysisSchema>;
export type AnalysisQuestion = z.infer<typeof analysisQuestionSchema>;

export const choiceDistributionSchema = z.object({
  sheet_id: z.string().uuid(),
  respondents: z.number(),
  questions: z.array(
    z.object({
      position: z.number(),
      question_id: z.string().uuid(),
      passage_title: z.string(),
      position_in_passage: z.number(),
      type_label: z.string().nullable(),
      difficulty: z.string().nullable(),
      correct_answer: z.number(),
      total: z.number(),
      correct: z.number(),
      unanswered: z.number(),
      /** ①~⑤ 선택 수 */
      counts: z.array(z.number()).length(5),
    }),
  ),
});
export type ChoiceDistribution = z.infer<typeof choiceDistributionSchema>;

/** 취약으로 꼽으려면 최소 이만큼은 풀어봤어야 — 학습 리포트 AREA_MIN_QUESTIONS 와 같은 값 */
export const ANALYSIS_WEAK_MIN = 5;
/** 오답 집중 선지: 정답 외 선지 하나에 이 비율 이상 몰리면 강조 */
export const WRONG_FOCUS_SHARE = 0.25;
