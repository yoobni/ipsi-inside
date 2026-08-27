import { z } from 'zod';

/** 칼럼 작성/편집 입력 — 원장이 제목 + 본문(HTML). */
export const columnInputSchema = z.object({
  title: z.string().trim().min(2, '제목을 입력해주세요').max(120),
  body: z.string().min(1, '본문을 입력해주세요'),
});

export type ColumnInput = z.infer<typeof columnInputSchema>;
