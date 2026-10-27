import { z } from 'zod';

/**
 * 코스(커리큘럼) · 회차 · 수업 진행 처리 → 회차 묶음 자동 배부.
 *
 * 회차에 미리 담아 둔 것(복습지·퀴즈·훈련·가이드·숙제)이 "○반 N주차 진행" 처리 한 번으로
 * 체크한 학생 모두에게 들어간다. 배부는 deliver_course_session() RPC 한 곳(멱등·알림 포함).
 * 중간 합류생은 지난 회차를 자동으로 받지 않는다 — 보강 배부(kind='makeup')로 따로 준다.
 */
export const COURSE_ITEM_KIND = ['material', 'test', 'drill', 'guide', 'homework'] as const;
export type CourseItemKind = (typeof COURSE_ITEM_KIND)[number];
export const COURSE_ITEM_KIND_LABEL: Record<CourseItemKind, string> = {
  material: '복습지·자료',
  test: '퀴즈·시험',
  drill: 'OX 훈련',
  guide: '학습 가이드',
  homework: '숙제',
};

export const DELIVERY_KIND = ['regular', 'makeup'] as const;
export type DeliveryKind = (typeof DELIVERY_KIND)[number];
export const DELIVERY_KIND_LABEL: Record<DeliveryKind, string> = {
  regular: '수업',
  makeup: '보강',
};

export const courseItemInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('material'), materialId: z.string().uuid({ message: '자료를 골라주세요' }) }),
  z.object({ kind: z.literal('test'), testSheetId: z.string().uuid({ message: '시험지를 골라주세요' }) }),
  z.object({ kind: z.literal('drill'), drillId: z.string().uuid({ message: '훈련을 골라주세요' }) }),
  z.object({ kind: z.literal('guide'), guideId: z.string().uuid({ message: '가이드를 골라주세요' }) }),
  z.object({
    kind: z.literal('homework'),
    title: z.string().trim().min(1, '숙제 내용을 입력해주세요').max(200),
    dueDays: z.number().int().min(0).max(60).nullable(),
  }),
]);
export type CourseItemInput = z.infer<typeof courseItemInputSchema>;

export const courseSaveSchema = z.object({
  title: z.string().trim().min(2, '코스 이름을 입력해주세요').max(80),
  description: z.string().trim().max(500).nullable().optional(),
  groupIds: z.array(z.string().uuid()).max(100),
});
export type CourseSaveInput = z.infer<typeof courseSaveSchema>;

/** 회차 저장 — 항목은 통째로 교체(순서 = 배열 순서). 이미 배부된 학생에게 소급되지는 않는다. */
export const courseSessionSaveSchema = z.object({
  title: z.string().trim().min(1, '회차 이름을 입력해주세요').max(60),
  summary: z.string().trim().max(500).nullable().optional(),
  items: z.array(courseItemInputSchema).max(30),
});
export type CourseSessionSaveInput = z.infer<typeof courseSessionSaveSchema>;

export const courseDeliverSchema = z.object({
  sessionId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1, '배부할 학생을 골라주세요').max(500),
  kind: z.enum(DELIVERY_KIND).default('regular'),
});
export type CourseDeliverInput = z.infer<typeof courseDeliverSchema>;

/** 숙제 마감(KST 날짜 YYYY-MM-DD) = 배부일(KST) + dueDays. 마감 당일까지 유효. */
export function homeworkDueDate(deliveredAtIso: string, dueDays: number | null): string | null {
  if (dueDays == null) return null;
  const kst = new Date(new Date(deliveredAtIso).getTime() + 9 * 3600_000);
  kst.setUTCDate(kst.getUTCDate() + dueDays);
  return kst.toISOString().slice(0, 10);
}
