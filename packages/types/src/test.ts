import { z } from "zod";

export const UNIT_MAJOR_PRESETS = [
  "문법",
  "문학",
  "독서",
  "화작",
  "언매",
] as const;

export const DIFFICULTY = ["상", "중", "하"] as const;

export const ASSIGNMENT_STATUS = ["assigned", "graded"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[number];

export const testSheetMetaSchema = z.object({
  title: z.string().min(2, "제목을 입력해주세요").max(100),
  targetSchool: z.string().max(50).nullable().optional(),
  targetGrade: z.coerce
    .number()
    .int()
    .min(1)
    .max(3)
    .nullable()
    .optional(),
  testDate: z.string().nullable().optional(), // ISO date string
});

export const testQuestionInputSchema = z.object({
  question_no: z.coerce.number().int().min(1),
  correct_answer: z.coerce.number().int().min(1).max(5),
  unit_major: z.string().min(1, "대단원을 입력해주세요").max(30),
  unit_minor: z.string().max(50).nullable().optional(),
  difficulty: z.enum(DIFFICULTY).nullable().optional(),
  points: z.coerce.number().int().min(1).default(1),
});

export const testSheetWithQuestionsSchema = z.object({
  meta: testSheetMetaSchema,
  questions: z
    .array(testQuestionInputSchema)
    .min(1, "최소 1개 이상의 문항을 입력해주세요")
    .refine(
      (arr) => new Set(arr.map((q) => q.question_no)).size === arr.length,
      { message: "문항 번호가 중복됩니다" },
    ),
});

export type TestSheetMeta = z.infer<typeof testSheetMetaSchema>;
export type TestQuestionInput = z.infer<typeof testQuestionInputSchema>;
export type TestSheetWithQuestions = z.infer<typeof testSheetWithQuestionsSchema>;

/** 학생 답안 마킹 — 한 학생의 모든 문항 한 번에 */
export const studentAnswersInputSchema = z.object({
  testSheetId: z.string().uuid(),
  studentId: z.string().uuid(),
  answers: z.array(
    z.object({
      question_no: z.coerce.number().int().min(1),
      selected: z
        .union([z.coerce.number().int().min(1).max(5), z.literal(null), z.undefined()])
        .transform((v) => (v === undefined || v === null ? null : v)),
    }),
  ),
});

export type StudentAnswersInput = z.infer<typeof studentAnswersInputSchema>;
