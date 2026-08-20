import { z } from "zod";

/* ─────────────────────────────────────────────────────────────────────────
 * 주간 국어 맞춤 플래너
 *   원장이 학생별 주간 타임테이블을 배정하고, 학생이 과제별로 O/△/X를 체크.
 *   시간은 (day_of_week 0~6, 자정 기준 분)으로 다룬다 — 날짜가 아니라야
 *   템플릿이 특정 주에 묶이지 않는다.
 * ───────────────────────────────────────────────────────────────────────── */

export const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const PLANNER_BLOCK_KIND = ["korean", "fixed"] as const;
export type PlannerBlockKind = (typeof PLANNER_BLOCK_KIND)[number];

export const PLANNER_BLOCK_KIND_LABEL: Record<PlannerBlockKind, string> = {
  korean: "국어",
  fixed: "고정 일정",
};

export const PLANNER_CHECK_STATUS = ["done", "late", "missed"] as const;
export type PlannerCheckStatus = (typeof PLANNER_CHECK_STATUS)[number];

/** 학생에게 보이는 3단계 라벨 — 요구사항의 O / △ / X */
export const PLANNER_CHECK_MARK: Record<PlannerCheckStatus, string> = {
  done: "O",
  late: "△",
  missed: "X",
};

export const PLANNER_CHECK_LABEL: Record<PlannerCheckStatus, string> = {
  done: "제시간에 완료",
  late: "늦었지만 당일 완료",
  missed: "미수행",
};

/**
 * △ 사유 프리셋 — 자유입력만 두면 통계로 못 묶인다.
 * 칩으로 먼저 고르게 하고, 그 외는 직접 입력.
 */
export const LATE_REASON_PRESETS = [
  "타 과목 숙제 지연",
  "학교/학원 일정이 길어짐",
  "컨디션 난조",
  "집중이 안 됨",
  "분량을 잘못 예상",
] as const;

/** 고정 일정 블록 색상 — 국어(주황)와 구분되는 팔레트만 노출 */
export const FIXED_BLOCK_COLORS = [
  "slate",
  "sky",
  "emerald",
  "violet",
  "rose",
] as const;
export type FixedBlockColor = (typeof FIXED_BLOCK_COLORS)[number];

/* ── 시간/날짜 헬퍼 (순수 함수 — 클라이언트 컴포넌트에서도 안전) ────────── */

/** 540 → "09:00" */
export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "09:00" → 540. 형식이 틀리면 null */
export function hhmmToMin(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 24 || mi < 0 || mi > 59) return null;
  const total = h * 60 + mi;
  return total > 1440 ? null : total;
}

/** YYYY-MM-DD 문자열에 일수 더하기 (UTC 고정 연산 — 로컬 타임존 영향 없음) */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 그 날짜가 속한 주의 월요일 (YYYY-MM-DD) */
export function weekStartOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=일 … 6=토
  const offset = dow === 0 ? -6 : 1 - dow; // 월요일까지의 거리
  return addDaysIso(iso, offset);
}

/** week_start + day_of_week → 실제 날짜. DB의 planner_task_date와 같은 계산 */
export function dateOfDay(weekStart: string, dayOfWeek: number): string {
  return addDaysIso(weekStart, dayOfWeek);
}

/** "2026-08-17" → "8/17(월)" */
export function shortDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 월=0 기준으로 회전
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DAY_LABELS[dow]})`;
}

/* ── zod 스키마 ──────────────────────────────────────────────────────────── */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다");

/**
 * id가 있으면 기존 행, 없으면 신규.
 * 저장을 "전부 지우고 다시 insert"로 하면 planner_tasks → planner_task_checks가
 * cascade로 함께 삭제돼 학생이 이미 체크한 기록이 날아간다. 원장은 발행 후에도
 * 수시로 수정하므로, id를 왕복시켜 diff(update/insert/delete)로 저장한다.
 */
export const plannerTaskInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "과제 내용을 입력해주세요").max(200),
  tag_id: z.string().uuid().nullable().optional(),
});

export const plannerBlockInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    day_of_week: z.coerce.number().int().min(0).max(6),
    start_min: z.coerce.number().int().min(0).max(1439),
    end_min: z.coerce.number().int().min(1).max(1440),
    kind: z.enum(PLANNER_BLOCK_KIND),
    label: z.string().trim().max(60).nullable().optional(),
    color: z.string().trim().max(20).nullable().optional(),
    memo: z.string().trim().max(300).nullable().optional(),
    tasks: z.array(plannerTaskInputSchema).max(20).optional().default([]),
  })
  .refine((v) => v.end_min > v.start_min, {
    message: "종료 시각이 시작 시각보다 늦어야 합니다",
    path: ["end_min"],
  })
  .refine((v) => v.kind !== "fixed" || !!v.label?.trim(), {
    message: "고정 일정은 이름을 입력해주세요",
    path: ["label"],
  })
  .refine((v) => v.kind === "korean" || (v.tasks?.length ?? 0) === 0, {
    message: "세부 과제는 국어 블록에만 넣을 수 있습니다",
    path: ["tasks"],
  });

/**
 * 한 주 플래너 전체를 통째로 저장(replace). 블록을 개별 CRUD로 쪼개면
 * 원장이 몇 번씩 저장을 눌러야 하고 중간 상태가 학생에게 새어나간다.
 */
export const plannerWeekSaveSchema = z.object({
  student_id: z.string().uuid(),
  week_start: isoDate,
  blocks: z.array(plannerBlockInputSchema).max(80),
});

export const plannerWeekPublishSchema = z.object({
  week_id: z.string().uuid(),
  publish: z.boolean(),
});

export const plannerWeeklyCommentSchema = z.object({
  week_id: z.string().uuid(),
  weekly_comment: z.string().trim().max(1000).nullable(),
});

/**
 * 템플릿 payload — 블록 구조 스냅샷 (학생/주차 정보와 행 id는 담지 않는다).
 * 저장 시 stripBlockIds로 id를 털어내고 넣는다.
 */
export const plannerTemplatePayloadSchema = z.object({
  blocks: z.array(plannerBlockInputSchema).max(80),
});

/** 템플릿에 넣기 전 행 id 제거 — 남아 있으면 불러올 때 남의 행을 덮어쓸 수 있다 */
export function stripBlockIds(blocks: PlannerBlockInput[]): PlannerBlockInput[] {
  return blocks.map((block) => ({
    day_of_week: block.day_of_week,
    start_min: block.start_min,
    end_min: block.end_min,
    kind: block.kind,
    label: block.label ?? null,
    color: block.color ?? null,
    memo: block.memo ?? null,
    tasks: (block.tasks ?? []).map((task) => ({
      title: task.title,
      tag_id: task.tag_id ?? null,
    })),
  }));
}

export const plannerTemplateSaveSchema = z.object({
  name: z.string().trim().min(1, "템플릿 이름을 입력해주세요").max(60),
  description: z.string().trim().max(300).nullable().optional(),
  payload: plannerTemplatePayloadSchema,
});

/**
 * 템플릿 → 여러 학생/그룹에 한 번에 배정.
 * 단건 배정만 만들면 HWP 대비 효율이 안 나온다 — 벌크가 기본.
 */
export const plannerTemplateApplySchema = z
  .object({
    template_id: z.string().uuid(),
    week_start: isoDate,
    student_ids: z.array(z.string().uuid()).optional().default([]),
    group_ids: z.array(z.string().uuid()).optional().default([]),
    /** 이미 플래너가 있는 주차 처리 */
    on_conflict: z.enum(["skip", "overwrite"]).default("skip"),
    /** 배정과 동시에 발행할지 */
    publish: z.boolean().default(false),
  })
  .refine(
    (v) => (v.student_ids?.length ?? 0) > 0 || (v.group_ids?.length ?? 0) > 0,
    { message: "학생 또는 그룹을 최소 1개 선택해주세요", path: ["student_ids"] },
  );

/** 학생 체크 입력. 여러 과제를 한 번에 보낼 수 있게 배열로 받는다. */
export const plannerCheckItemSchema = z
  .object({
    task_id: z.string().uuid(),
    status: z.enum(PLANNER_CHECK_STATUS),
    late_reason: z.string().trim().max(200).nullable().optional(),
    photo_path: z.string().trim().max(300).nullable().optional(),
  })
  .refine((v) => v.status === "late" || !v.late_reason, {
    message: "사유는 △(늦게 완료)일 때만 입력합니다",
    path: ["late_reason"],
  })
  .refine((v) => v.status !== "missed" || !v.photo_path, {
    message: "미수행에는 사진을 첨부할 수 없습니다",
    path: ["photo_path"],
  });

export const plannerCheckSubmitSchema = z.object({
  items: z.array(plannerCheckItemSchema).min(1).max(30),
});

export type PlannerTaskInput = z.infer<typeof plannerTaskInputSchema>;
export type PlannerBlockInput = z.infer<typeof plannerBlockInputSchema>;
export type PlannerWeekSave = z.infer<typeof plannerWeekSaveSchema>;
export type PlannerTemplatePayload = z.infer<typeof plannerTemplatePayloadSchema>;
export type PlannerTemplateSave = z.infer<typeof plannerTemplateSaveSchema>;
export type PlannerTemplateApply = z.infer<typeof plannerTemplateApplySchema>;
export type PlannerCheckItem = z.infer<typeof plannerCheckItemSchema>;
export type PlannerCheckSubmit = z.infer<typeof plannerCheckSubmitSchema>;
