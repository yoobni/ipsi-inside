import { z } from "zod";

/* ─────────────────────────────────────────────────────────────────────────
 * 자료 배부 (PDF) — 학생/학부모에게 자료 PDF를 광역/핀포인트로 배포
 * ───────────────────────────────────────────────────────────────────────── */

export const MATERIAL_AUDIENCE = [
  "all",
  "student",
  "parent",
  "targeted",
  "group",
] as const;
export type MaterialAudience = (typeof MATERIAL_AUDIENCE)[number];

export const MATERIAL_AUDIENCE_LABEL: Record<MaterialAudience, string> = {
  all: "전체",
  student: "학생 광역",
  parent: "학부모 광역",
  targeted: "핀포인트",
  group: "그룹(반)",
};

export const MAX_MATERIAL_BYTES = 30 * 1024 * 1024; // 30MB

export const materialFileSchema = z.object({
  storage_path: z.string().min(1),
  file_name: z.string().min(1).max(255),
  file_size_bytes: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_MATERIAL_BYTES, "30MB 이하의 PDF만 업로드 가능합니다"),
});

export const materialInputSchema = z.object({
  title: z.string().trim().min(2, "제목을 입력해주세요").max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  audience: z.enum(MATERIAL_AUDIENCE),
  expires_at: z.string().nullable().optional(),
  // 묶음 배부: 1개 이상의 PDF
  files: z.array(materialFileSchema).min(1, "PDF를 최소 1개 올려주세요"),
});

export const materialUpdateSchema = z.object({
  title: z.string().trim().min(2, "제목을 입력해주세요").max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  audience: z.enum(MATERIAL_AUDIENCE),
  expires_at: z.string().nullable().optional(),
});

export const materialAssignmentSchema = z
  .object({
    material_id: z.string().uuid(),
    schools: z.array(z.string().min(1)).optional().default([]),
    student_ids: z.array(z.string().uuid()).optional().default([]),
  })
  .refine(
    (v) => (v.schools?.length ?? 0) > 0 || (v.student_ids?.length ?? 0) > 0,
    { message: "학교 또는 학생을 최소 1개 선택해주세요" },
  );

export type MaterialInput = z.infer<typeof materialInputSchema>;
export type MaterialFileInput = z.infer<typeof materialFileSchema>;
export type MaterialUpdate = z.infer<typeof materialUpdateSchema>;
export type MaterialAssignmentInput = z.infer<typeof materialAssignmentSchema>;
