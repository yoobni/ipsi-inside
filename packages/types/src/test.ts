import { z } from "zod";

export const UNIT_MAJOR_PRESETS = [
  "독서-인문",
  "독서-사회",
  "독서-과학",
  "독서-기술",
  "독서-예술",
  "문학-현대시",
  "문학-현대소설",
  "문학-고전시가",
  "문학-고전소설",
  "문학-극/수필",
  "화법",
  "작문",
  "언어",
  "매체",
] as const;

export const DIFFICULTY = ["상", "중", "하"] as const;
export type Difficulty = (typeof DIFFICULTY)[number];

export const PASSAGE_SOURCE = [
  "reading",
  "literature",
  "speech_writing",
  "language_media",
] as const;
export type PassageSource = (typeof PASSAGE_SOURCE)[number];

export const PASSAGE_SOURCE_LABEL: Record<PassageSource, string> = {
  reading: "비문학(독서)",
  literature: "문학",
  speech_writing: "화법과작문",
  language_media: "언어와매체",
};

export const ATTEMPT_STATUS = ["in_progress", "submitted"] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUS)[number];

/* ─────────────────────────────────────────────────────────────────────────
 * 지문 / 문항 등록
 * ───────────────────────────────────────────────────────────────────────── */

export const questionChoiceSchema = z.object({
  no: z.number().int().min(1).max(5),
  text: z.string().min(1, "선지 내용을 입력해주세요"),
});

export const questionInputSchema = z.object({
  position_in_passage: z.coerce.number().int().min(1),
  stem: z.string().min(1, "문제 본문을 입력해주세요"),
  supplementary: z.string().nullable().optional(),
  choices: z
    .array(questionChoiceSchema)
    .min(2, "최소 2개 이상의 선지")
    .max(5, "최대 5개까지"),
  correct_answer: z.coerce.number().int().min(1).max(5),
  points: z.coerce.number().int().min(1).max(10).default(2),
  difficulty: z.enum(DIFFICULTY).nullable().optional(),
  unit_minor: z.string().max(50).nullable().optional(),
});

export const passageInputSchema = z.object({
  title: z.string().min(2, "지문 제목을 입력해주세요").max(100),
  source_type: z.enum(PASSAGE_SOURCE),
  content: z.string().min(1, "지문 본문을 입력해주세요"),
  unit_major: z.string().min(1, "대단원을 선택/입력해주세요").max(30),
  unit_minor: z.string().max(50).nullable().optional(),
});

export const passageWithQuestionsSchema = z.object({
  passage: passageInputSchema,
  questions: z
    .array(questionInputSchema)
    .min(1, "문항을 최소 1개 등록해주세요")
    .refine(
      (arr) =>
        new Set(arr.map((q) => q.position_in_passage)).size === arr.length,
      { message: "지문 내 문항 번호가 중복됩니다" },
    )
    .refine(
      (arr) =>
        arr.every(
          (q) => q.correct_answer >= 1 && q.correct_answer <= q.choices.length,
        ),
      { message: "정답이 선지 범위를 벗어났습니다" },
    ),
});

export type QuestionChoice = z.infer<typeof questionChoiceSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;
export type PassageInput = z.infer<typeof passageInputSchema>;
export type PassageWithQuestions = z.infer<typeof passageWithQuestionsSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * 시험지 (메타 + 일정 + 재응시 정책)
 * ───────────────────────────────────────────────────────────────────────── */

export const testSheetInputSchema = z
  .object({
    title: z.string().min(2, "제목을 입력해주세요").max(100),
    description: z.string().max(500).nullable().optional(),
    target_school: z.string().max(50).nullable().optional(),
    target_grade: z.coerce
      .number()
      .int()
      .min(1)
      .max(3)
      .nullable()
      .optional(),
    open_at: z.string().nullable().optional(),  // ISO datetime
    due_at: z.string().nullable().optional(),
    allow_retake: z.coerce.boolean().default(false),
    max_attempts: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .nullable()
      .optional(),
  })
  .refine(
    (v) => !v.open_at || !v.due_at || new Date(v.open_at) < new Date(v.due_at),
    { message: "오픈일이 마감일보다 늦을 수 없습니다", path: ["due_at"] },
  );

export const testSheetCompositionSchema = z.object({
  meta: testSheetInputSchema,
  question_ids: z
    .array(z.string().uuid())
    .min(1, "문항을 최소 1개 추가해주세요")
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "같은 문항을 중복으로 넣을 수 없습니다",
    }),
});

export type TestSheetInput = z.infer<typeof testSheetInputSchema>;
export type TestSheetComposition = z.infer<typeof testSheetCompositionSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * 배정 (학교 단위 + 개별 학생)
 * ───────────────────────────────────────────────────────────────────────── */

export const assignmentInputSchema = z
  .object({
    test_sheet_id: z.string().uuid(),
    schools: z.array(z.string().min(1)).optional().default([]),
    student_ids: z.array(z.string().uuid()).optional().default([]),
  })
  .refine(
    (v) => (v.schools?.length ?? 0) > 0 || (v.student_ids?.length ?? 0) > 0,
    { message: "학교 또는 학생을 최소 1명/1개 선택해주세요" },
  );

export type AssignmentInput = z.infer<typeof assignmentInputSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * 학생 응시
 * ───────────────────────────────────────────────────────────────────────── */

export const attemptAnswerSchema = z.object({
  question_id: z.string().uuid(),
  selected: z.union([
    z.coerce.number().int().min(1).max(5),
    z.null(),
  ]),
});

export const attemptSubmitSchema = z.object({
  attempt_id: z.string().uuid(),
  answers: z.array(attemptAnswerSchema),
});

export type AttemptAnswer = z.infer<typeof attemptAnswerSchema>;
export type AttemptSubmit = z.infer<typeof attemptSubmitSchema>;
