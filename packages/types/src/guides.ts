import { z } from 'zod';

/**
 * 작품/지문 학습 가이드 — 단계형 자습서. 단계 payload 는 kind 별(아래).
 * 지문 본문은 guide_passage() RPC 로만(발행된 가이드의 read 단계).
 */
export const GUIDE_STEP_KIND = ['intro', 'read', 'visual', 'comic', 'ox', 'questions', 'review', 'summary'] as const;
export type GuideStepKind = (typeof GUIDE_STEP_KIND)[number];
export const GUIDE_STEP_KIND_LABEL: Record<GuideStepKind, string> = {
  intro: '핵심 가이드',
  read: '지문 읽기',
  visual: '시각 자료',
  comic: '핵심 장면',
  ox: 'OX 훈련',
  questions: '관련 문제',
  review: '틀린 것 복습',
  summary: '핵심 정리',
};
export const GUIDE_STEP_KIND_HINT: Record<GuideStepKind, string> = {
  intro: '이 작품을 왜·어떻게 읽을지 한 장(글)',
  read: '등록된 지문 하나를 골라 본문을 보여줘요',
  visual: '인물 관계도·개념도 이미지(+설명)',
  comic: '핵심 장면 만화/이미지(+설명)',
  ox: '발행된 OX 훈련 하나를 연결해요',
  questions: '작품 태그 문항으로 보충 세트를 만들어 풀게 해요',
  review: '틀린 것 복습 안내(글) — 리포트로 연결',
  summary: '마지막 핵심 정리(글)',
};

const imageSchema = z.object({
  url: z.string().url(),
  path: z.string().min(1),
  caption: z.string().trim().max(200).nullable().optional(),
});

export const guideStepPayloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('intro'), html: z.string().min(1, '내용을 입력해주세요') }),
  z.object({ kind: z.literal('summary'), html: z.string().min(1, '내용을 입력해주세요') }),
  z.object({ kind: z.literal('review'), html: z.string().min(1, '내용을 입력해주세요') }),
  z.object({ kind: z.literal('read'), passage_id: z.string().uuid({ message: '지문을 골라주세요' }), note: z.string().trim().max(500).nullable().optional() }),
  z.object({ kind: z.literal('visual'), images: z.array(imageSchema).min(1, '이미지를 1장 이상 올려주세요').max(10), html: z.string().nullable().optional() }),
  z.object({ kind: z.literal('comic'), images: z.array(imageSchema).min(1, '이미지를 1장 이상 올려주세요').max(20), html: z.string().nullable().optional() }),
  z.object({ kind: z.literal('ox'), drill_id: z.string().uuid({ message: '훈련을 골라주세요' }) }),
  z.object({ kind: z.literal('questions'), size: z.number().int().min(3).max(20).default(10), note: z.string().trim().max(500).nullable().optional() }),
]);
export type GuideStepPayload = z.infer<typeof guideStepPayloadSchema>;

export const guideSaveSchema = z.object({
  title: z.string().trim().min(2, '제목을 입력해주세요').max(80),
  summary: z.string().trim().max(300).nullable().optional(),
  workId: z.string().uuid().nullable().optional(),
  steps: z
    .array(
      z.object({
        id: z.string().uuid().nullable().optional(),
        title: z.string().trim().min(1, '단계 제목을 입력해주세요').max(60),
        payload: guideStepPayloadSchema,
      }),
    )
    .min(1, '단계를 1개 이상 넣어주세요')
    .max(20),
});
export type GuideSaveInput = z.infer<typeof guideSaveSchema>;

export const guidePassageSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  source_type: z.string(),
  work: z.string().nullable(),
  source: z.string().nullable(),
});
export type GuidePassage = z.infer<typeof guidePassageSchema>;
