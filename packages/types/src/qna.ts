import { z } from 'zod';

/**
 * Q&A — 일지(매일 피드백)와 분리된 질의응답.
 * 카테고리·가이드라인은 DB(qna_categories)에서 원장이 관리한다.
 */

/** 학생 질문 작성 입력. reference/no는 '숙제'처럼 문항을 지목하는 카테고리에서 쓴다. */
export const qnaQuestionInputSchema = z.object({
  categoryId: z.string().uuid('분류를 선택해주세요'),
  referenceLabel: z.string().trim().max(60).optional().nullable(),
  questionNo: z.string().trim().max(20).optional().nullable(),
  body: z.string().trim().min(5, '질문을 조금 더 자세히 적어주세요').max(4000),
  // 업로드된 이미지 경로 (선택). 클라에서 먼저 업로드 후 경로만 넘긴다.
  imagePath: z.string().trim().max(300).optional().nullable(),
});
export type QnaQuestionInput = z.infer<typeof qnaQuestionInputSchema>;

/** 원장 답변 작성/발행 입력. */
export const qnaAnswerInputSchema = z.object({
  questionId: z.string().uuid(),
  body: z.string().trim().min(1, '답변을 입력해주세요').max(8000),
  /** true면 저장과 동시에 발행(학생에게 노출), false면 검수 초안으로만 저장 */
  publish: z.boolean().default(false),
});
export type QnaAnswerInput = z.infer<typeof qnaAnswerInputSchema>;

/** 카테고리(가이드라인) 편집 입력 — 원장용. */
export const qnaCategoryInputSchema = z.object({
  label: z.string().trim().min(1, '이름을 입력해주세요').max(20),
  placeholder: z.string().trim().max(300).optional().nullable(),
  needsReference: z.boolean().default(false),
});
export type QnaCategoryInput = z.infer<typeof qnaCategoryInputSchema>;

export type QnaQuestionStatus = 'open' | 'answered';
