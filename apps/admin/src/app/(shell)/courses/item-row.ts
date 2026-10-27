import type { CourseItemInput } from "@ipsi/types";

/** course_session_items 행(편집기에 필요한 컬럼만) */
export type ItemDbRow = {
  id: string;
  kind: CourseItemInput["kind"];
  material_id: string | null;
  test_sheet_id: string | null;
  drill_id: string | null;
  guide_id: string | null;
  title: string | null;
  due_days: number | null;
};

/** DB 행 → 편집기 입력(id 포함). 참조가 비어 있는 깨진 행은 건너뛴다. */
export function itemRowToInput(r: ItemDbRow): CourseItemInput[] {
  switch (r.kind) {
    case "material": return r.material_id ? [{ kind: "material", id: r.id, materialId: r.material_id }] : [];
    case "test": return r.test_sheet_id ? [{ kind: "test", id: r.id, testSheetId: r.test_sheet_id }] : [];
    case "drill": return r.drill_id ? [{ kind: "drill", id: r.id, drillId: r.drill_id }] : [];
    case "guide": return r.guide_id ? [{ kind: "guide", id: r.id, guideId: r.guide_id }] : [];
    case "homework": return r.title ? [{ kind: "homework", id: r.id, title: r.title, dueDays: r.due_days }] : [];
  }
}

/** 학생 한 줄 보조 정보 — "학교 · N학년" */
export function studentLine(s: { school: string | null; grade: number | null }): string {
  return [s.school, s.grade ? `${s.grade}학년` : null].filter(Boolean).join(" · ");
}
