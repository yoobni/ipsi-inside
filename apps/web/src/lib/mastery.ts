import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ipsi/db";
import {
  MASTERY_MIN_TOTAL,
  MASTERY_WEAK_BELOW,
  PASSAGE_SOURCE_LABEL,
  plannerRate,
  studentMasterySchema,
  type MasteryTag,
  type PassageSource,
  type PracticeTagKind,
  type StudentMastery,
} from "@ipsi/types";

export async function getStudentMastery(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<StudentMastery | null> {
  const { data, error } = await supabase.rpc("student_mastery", { p_student: studentId });
  if (error || data == null) return null;
  const parsed = studentMasterySchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export type MasteryRow = {
  kind: PracticeTagKind | "area";
  id: string;
  label: string;
  area: string | null;
  total: number;
  rate: number;
  recentRate: number | null;
  /** recentRate - 이전 90일 rate (%p). 둘 다 있을 때만 */
  trend: number | null;
  weak: boolean;
};

function toRow(kind: MasteryRow["kind"], t: MasteryTag): MasteryRow {
  const rate = plannerRate(t.correct, t.total) ?? 0;
  const recentRate = plannerRate(t.recent_correct, t.recent_total);
  const prevTotal = t.total - t.recent_total;
  const prevRate = prevTotal > 0 ? plannerRate(t.correct - t.recent_correct, prevTotal) : null;
  return {
    kind,
    id: t.id,
    label: t.label,
    area: t.area,
    total: t.total,
    rate,
    recentRate,
    trend: recentRate !== null && prevRate !== null ? recentRate - prevRate : null,
    weak: t.total >= MASTERY_MIN_TOTAL && rate < MASTERY_WEAK_BELOW,
  };
}

/**
 * 취약 태그(총 8문항↑ & 65% 미만), 정답률 낮은 순. 유형·작품·개념을 한 목록으로.
 * 영역은 보충 세트를 못 만드니(태그 uuid 없음) 참고용으로만 따로.
 */
export function deriveMastery(m: StudentMastery) {
  const tags: MasteryRow[] = [
    ...m.by_type.map((t) => toRow("type", t)),
    ...m.by_work.map((t) => toRow("work", t)),
    ...m.by_concept.map((t) => toRow("concept", t)),
  ];
  const areas: MasteryRow[] = m.by_area.map((a) =>
    toRow("area", { ...a, label: PASSAGE_SOURCE_LABEL[a.id as PassageSource] ?? a.id, area: null }),
  );
  const weak = tags.filter((t) => t.weak).sort((a, b) => a.rate - b.rate);
  const strong = tags.filter((t) => t.total >= MASTERY_MIN_TOTAL && t.rate >= 85).sort((a, b) => b.rate - a.rate);
  return { tags, areas, weak, strong };
}
