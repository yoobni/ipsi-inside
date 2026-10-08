import { z } from 'zod';
import { PASSAGE_SOURCE } from './test';

/**
 * OX · 짧은 인터랙티브 훈련. 1차 3종.
 * 항목 payload/answer 는 kind 별로 다르다(아래 스키마). 학생에게는 answer 없이
 * drill_play() 결과만 간다.
 */
export const DRILL_KIND = ['ox', 'choice', 'classify'] as const;
export type DrillKind = (typeof DRILL_KIND)[number];
export const DRILL_KIND_LABEL: Record<DrillKind, string> = {
  ox: 'OX',
  choice: '보기 선택',
  classify: '분류',
};
export const DRILL_KIND_HINT: Record<DrillKind, string> = {
  ox: '진술이 맞으면 O, 틀리면 X',
  choice: '보기 2~5개 중 하나',
  classify: '단어·예문을 바구니(명사/대명사/수사 …)에 넣기',
};

// ── 항목 ──────────────────────────────────────────────────────────────────────
export const oxItemSchema = z.object({
  kind: z.literal('ox'),
  prompt: z.string().trim().min(1, '진술을 입력해주세요').max(500),
  answer: z.object({ value: z.boolean() }),
  explanation: z.string().trim().max(1000).nullable().optional(),
});
export const choiceItemSchema = z.object({
  kind: z.literal('choice'),
  prompt: z.string().trim().min(1, '문제를 입력해주세요').max(500),
  options: z.array(z.string().trim().min(1, '보기를 입력해주세요').max(200)).min(2).max(5),
  answer: z.object({ index: z.number().int().min(0).max(4) }),
  explanation: z.string().trim().max(1000).nullable().optional(),
});
export const classifyItemSchema = z.object({
  kind: z.literal('classify'),
  prompt: z.string().trim().min(1, '지시문을 입력해주세요').max(500),
  buckets: z.array(z.string().trim().min(1).max(40)).min(2).max(4),
  tokens: z.array(z.string().trim().min(1).max(60)).min(2).max(12),
  answer: z.object({ assignments: z.array(z.number().int().min(0).max(3)) }),
  explanation: z.string().trim().max(1000).nullable().optional(),
});

// discriminatedUnion 멤버에는 refine 을 못 붙여서, 분류 항목의 교차 검증은 여기서 한다
export const drillItemInputSchema = z
  .discriminatedUnion('kind', [oxItemSchema, choiceItemSchema, classifyItemSchema])
  .superRefine((v, ctx) => {
    if (v.kind === 'classify') {
      if (v.answer.assignments.length !== v.tokens.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '토큰마다 바구니를 정해주세요', path: ['answer'] });
      }
      if (v.answer.assignments.some((a) => a >= v.buckets.length)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '바구니 번호가 범위를 벗어났어요', path: ['answer'] });
      }
    }
    if (v.kind === 'choice' && v.answer.index >= v.options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '정답이 보기 범위를 벗어났어요', path: ['answer'] });
    }
  });
export type DrillItemInput = z.infer<typeof drillItemInputSchema>;

/** 저장 입력 — 항목에 id 가 있으면 갱신, 없으면 신규. 빠진 id 는 삭제(결과도 같이). */
export const drillSaveSchema = z
  .object({
    title: z.string().trim().min(2, '제목을 입력해주세요').max(80),
    description: z.string().trim().max(300).nullable().optional(),
    kind: z.enum(DRILL_KIND),
    area: z.enum(PASSAGE_SOURCE).nullable().optional(),
    workId: z.string().uuid().nullable().optional(),
    conceptIds: z.array(z.string().uuid()).max(20).default([]),
    timeLimitSec: z.number().int().min(3).max(300).nullable().optional(),
    items: z
      .array(z.object({ id: z.string().uuid().nullable().optional(), item: drillItemInputSchema }))
      .min(1, '항목을 1개 이상 넣어주세요')
      .max(30),
  })
  .refine((v) => v.items.every((x) => x.item.kind === v.kind), {
    message: '항목 종류가 훈련 종류와 달라요',
    path: ['items'],
  });
export type DrillSaveInput = z.infer<typeof drillSaveSchema>;

// ── RPC 결과 ──────────────────────────────────────────────────────────────────
export const drillPlaySchema = z.object({
  drill: z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    kind: z.enum(DRILL_KIND),
    time_limit_sec: z.number().nullable(),
  }),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number(),
      prompt: z.string(),
      payload: z.record(z.string(), z.unknown()),
    }),
  ),
});
export type DrillPlay = z.infer<typeof drillPlaySchema>;
export type DrillPlayItem = DrillPlay['items'][number];

export const drillAnswerResultSchema = z.object({
  correct: z.boolean(),
  answer: z.record(z.string(), z.unknown()),
  explanation: z.string().nullable(),
  retry_no: z.number(),
});
export type DrillAnswerResult = z.infer<typeof drillAnswerResultSchema>;

export const drillFinishSchema = z.object({
  correct: z.number(),
  total: z.number(),
  wrong_item_ids: z.array(z.string().uuid()),
});
export type DrillFinish = z.infer<typeof drillFinishSchema>;
