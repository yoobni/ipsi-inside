import { z } from 'zod';

/** 학생 라이브러리(허브) — library_index / library_detail RPC jsonb 형태. 메타만, 본문·정답 없음. */

export const LIBRARY_KIND = ['work', 'concept', 'source'] as const;
export type LibraryKind = (typeof LIBRARY_KIND)[number];
export const LIBRARY_KIND_LABEL: Record<LibraryKind, string> = {
  work: '작품·제재',
  concept: '개념',
  source: '기출',
};

export const libraryIndexSchema = z.object({
  works: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      author: z.string().nullable(),
      genre: z.string().nullable(),
      era: z.string().nullable(),
      passages: z.number(),
      questions: z.number(),
      drills: z.number(),
    }),
  ),
  concepts: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      area: z.string().nullable(),
      parent_id: z.string().uuid().nullable(),
      has_body: z.boolean(),
      questions: z.number(),
      drills: z.number(),
    }),
  ),
  sources: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      year: z.number().nullable(),
      month: z.number().nullable(),
      exam_kind: z.string().nullable(),
      grade: z.number().nullable(),
      passages: z.number(),
      questions: z.number(),
    }),
  ),
});
export type LibraryIndex = z.infer<typeof libraryIndexSchema>;

const ref = z.object({ id: z.string().uuid(), title: z.string() });

export const libraryDetailSchema = z.object({
  kind: z.enum(LIBRARY_KIND),
  id: z.string().uuid(),
  head: z.record(z.string(), z.unknown()),
  passages: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      source_type: z.string(),
      questions: z.number(),
      source: z.string().nullable(),
      work: z.string().nullable(),
    }),
  ),
  question_count: z.number(),
  by_type: z.array(z.object({ type_id: z.string().uuid().nullable(), label: z.string(), count: z.number() })),
  sources: z.array(z.object({ id: z.string().uuid(), label: z.string() })),
  works: z.array(ref.extend({ author: z.string().nullable() })),
  concepts: z.array(ref),
  drills: z.array(ref.extend({ kind: z.string() })),
});
export type LibraryDetail = z.infer<typeof libraryDetailSchema>;
