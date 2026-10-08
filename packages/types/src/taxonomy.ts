import { z } from 'zod';
import { PASSAGE_SOURCE, UNIT_MAJOR_PRESETS } from './test';

/**
 * 문항 태그 체계 — 유형 · 작품/제재 · 기출 출처 · 개념. 원장이 어드민
 * `/passages/taxonomy` 에서 관리하고, 지문/문항 폼과 CSV 가져오기가 참조한다.
 * 집계(시험 분석·취약점)는 태깅된 문항만 세고 '미분류 N'을 같이 보여준다.
 */

export const EXAM_KIND = ['수능', '모평', '학평', '사설', '기타'] as const;
export type ExamKind = (typeof EXAM_KIND)[number];

/** 작품 갈래 — 기존 대단원 프리셋을 그대로 쓴다(문학-현대시 …) */
export const WORK_GENRE_PRESETS = UNIT_MAJOR_PRESETS;

export const questionTypeInputSchema = z.object({
  area: z.enum(PASSAGE_SOURCE),
  label: z.string().trim().min(1, '유형 이름을 입력해주세요').max(40),
});
export type QuestionTypeInput = z.infer<typeof questionTypeInputSchema>;

export const workInputSchema = z.object({
  title: z.string().trim().min(1, '작품명을 입력해주세요').max(100),
  author: z.string().trim().max(50).nullable().optional(),
  genre: z.string().trim().max(30).nullable().optional(),
  era: z.string().trim().max(30).nullable().optional(),
});
export type WorkInput = z.infer<typeof workInputSchema>;

export const examSourceInputSchema = z.object({
  label: z.string().trim().min(1, '출처 표시명을 입력해주세요').max(60),
  year: z.coerce.number().int().min(2000).max(2100).nullable().optional(),
  month: z.coerce.number().int().min(1).max(12).nullable().optional(),
  examKind: z.enum(EXAM_KIND).nullable().optional(),
  grade: z.coerce.number().int().min(1).max(3).nullable().optional(),
});
export type ExamSourceInput = z.infer<typeof examSourceInputSchema>;

export const conceptInputSchema = z.object({
  title: z.string().trim().min(1, '개념 이름을 입력해주세요').max(60),
  area: z.enum(PASSAGE_SOURCE).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
});
export type ConceptInput = z.infer<typeof conceptInputSchema>;

/** 폼·CSV가 참조하는 사전 목록(라벨만) — 페이지가 한 번 읽어 폼에 넘긴다 */
export type TaxonomyLists = {
  types: { id: string; area: string; label: string }[];
  works: { id: string; title: string; author: string | null }[];
  sources: { id: string; label: string }[];
  concepts: { id: string; title: string; area: string | null }[];
};
