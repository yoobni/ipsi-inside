import { z } from 'zod';

/** 칼럼 작성/편집 입력 — 원장이 제목 + 본문(HTML) + 카테고리(선택). */
export const columnInputSchema = z.object({
  title: z.string().trim().min(2, '제목을 입력해주세요').max(120),
  body: z.string().min(1, '본문을 입력해주세요'),
  categoryId: z.string().uuid().nullable().optional(),
});

export type ColumnInput = z.infer<typeof columnInputSchema>;

/** 칼럼 카테고리(문학/독서/언어와 매체/공부법/입시·공지 …) — 원장이 관리. */
export const columnCategoryInputSchema = z.object({
  label: z.string().trim().min(1, '이름을 입력해주세요').max(20),
});

export type ColumnCategoryInput = z.infer<typeof columnCategoryInputSchema>;
