import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ipsi/db";
import {
  AREA_MIN_QUESTIONS,
  PASSAGE_SOURCE_LABEL,
  TEST_DELTA_WINDOW,
  plannerRate,
  studentStatsSchema,
  top3BoardsSchema,
  type PassageSource,
  type StatsWeek,
  type StudentStats,
  type Top3Boards,
} from "@ipsi/types";

/**
 * 학습 리포트 데이터. RPC 한 번 + zod 파싱. 형태가 안 맞거나 권한이 없으면 null —
 * 화면은 null이면 섹션을 숨긴다(500을 내지 않는다).
 */
export async function getStudentStats(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<StudentStats | null> {
  const { data, error } = await supabase.rpc("student_stats", { p_student: studentId });
  if (error || data == null) return null;
  const parsed = studentStatsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/**
 * TOP3 보드. 학생은 본인 기준, 학부모는 자녀 id를 넘긴다(연결 안 된 자녀면 RPC가
 * raise → null). 원장이 보드를 다 꺼두면 boards가 빈 배열.
 */
export async function getTop3Boards(
  supabase: SupabaseClient<Database>,
  studentId?: string,
): Promise<Top3Boards | null> {
  const { data, error } = await supabase.rpc("top3_boards", {
    p_student: studentId ?? null,
    p_group: null,
  });
  if (error || data == null) return null;
  const parsed = top3BoardsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** 비율 하나와 그 전 구간 대비 변화(%p). null = 분모 0 / 비교 불가 */
export type RateWithDelta = {
  rate: number | null;
  prevRate: number | null;
  /** rate - prevRate (%p). 둘 중 하나라도 null이면 null */
  delta: number | null;
};

function withDelta(rate: number | null, prevRate: number | null): RateWithDelta {
  return {
    rate,
    prevRate,
    delta: rate !== null && prevRate !== null ? rate - prevRate : null,
  };
}

/** (출석 + 0.5×지각) / 마킹된 날 — weekly-summary와 같은 식 */
export function attendanceRate(w: {
  att_marked: number;
  att_present: number;
  att_late: number;
}): number | null {
  if (w.att_marked <= 0) return null;
  return Math.round(((w.att_present + w.att_late * 0.5) / w.att_marked) * 100);
}

/** 과제 수행률 — (O + △) / 도래 과제. 발행 플래너 없으면 null */
export function homeworkRate(w: StatsWeek): number | null {
  if (!w.planner) return null;
  return plannerRate(w.hw_done + w.hw_late, w.hw_due);
}

export type JournalBasis = "class_days" | "weekdays";

/**
 * 학습일지 작성률. 분모는 출석일(원장이 출석/지각으로 마킹한 날) — 안 온 날 안 쓴 걸
 * 빼먹었다고 하지 않기 위해. 마킹이 전혀 없으면 지난 평일 수로 대신한다.
 */
export function journalRate(w: {
  class_days: number;
  journal_class_days: number;
  journal_days: number;
  weekdays_elapsed: number;
}): { rate: number | null; basis: JournalBasis } {
  if (w.class_days > 0) {
    return { rate: plannerRate(w.journal_class_days, w.class_days), basis: "class_days" };
  }
  return { rate: plannerRate(w.journal_days, w.weekdays_elapsed), basis: "weekdays" };
}

export type AreaRow = {
  source: string;
  label: string;
  rate: number | null;
  prevRate: number | null;
  delta: number | null;
  total: number;
  correct: number;
};

export type DerivedStats = {
  /** 이번 주 vs 지난 주 */
  homework: RateWithDelta;
  attendance: RateWithDelta;
  journal: RateWithDelta & { basis: JournalBasis };
  /** 전월 vs 이번 달(MTD) */
  monthlyAttendance: { prev: number | null; current: number | null; currentLabel: string };
  /** 최근 N시트 평균 vs 그 이전 N시트 평균 (점수율) */
  tests: RateWithDelta & { count: number };
  areas: AreaRow[];
  /** total ≥ AREA_MIN_QUESTIONS 중 정답률 최저 */
  weakArea: AreaRow | null;
  /** 보여줄 데이터가 하나라도 있는지 */
  hasAnyData: boolean;
};

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

export function deriveStats(s: StudentStats): DerivedStats {
  const weeks = s.weeks;
  const cur = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];

  const homework = withDelta(
    cur ? homeworkRate(cur) : null,
    prev ? homeworkRate(prev) : null,
  );
  const attendance = withDelta(
    cur ? attendanceRate(cur) : null,
    prev ? attendanceRate(prev) : null,
  );
  const jCur = cur ? journalRate(cur) : { rate: null, basis: "class_days" as const };
  const jPrev = prev ? journalRate(prev) : { rate: null, basis: "class_days" as const };
  // 두 주의 분모 기준(출석일 / 평일)이 다르면 비교가 성립하지 않는다 — 델타 없음
  const journal = {
    ...withDelta(jCur.rate, jCur.basis === jPrev.basis ? jPrev.rate : null),
    basis: jCur.basis,
  };

  const mPrev = s.months[0];
  const mCur = s.months[1];
  const monthlyAttendance = {
    prev: mPrev ? attendanceRate(mPrev) : null,
    current: mCur ? attendanceRate(mCur) : null,
    currentLabel: mCur ? `${Number(mCur.month.slice(5))}월(진행 중)` : "이번 달",
  };

  // 시험: tests는 오래된→최신. 최근 N vs 그 이전 N.
  const pcts = s.tests.map((t) => Math.round((t.score / t.total) * 100));
  const recent = pcts.slice(-TEST_DELTA_WINDOW);
  const before = pcts.slice(-TEST_DELTA_WINDOW * 2, -TEST_DELTA_WINDOW);
  const tests = { ...withDelta(avg(recent), avg(before)), count: s.tests.length };

  const prevBySource = new Map(s.areas.previous.map((a) => [a.source, a] as const));
  const areas: AreaRow[] = s.areas.current.map((a) => {
    const p = prevBySource.get(a.source);
    const rate = plannerRate(a.correct, a.total);
    const prevRate = p ? plannerRate(p.correct, p.total) : null;
    return {
      source: a.source,
      label: PASSAGE_SOURCE_LABEL[a.source as PassageSource] ?? a.source,
      rate,
      prevRate,
      delta: rate !== null && prevRate !== null ? rate - prevRate : null,
      total: a.total,
      correct: a.correct,
    };
  });
  const weakArea =
    areas
      .filter((a) => a.total >= AREA_MIN_QUESTIONS && a.rate !== null)
      .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))[0] ?? null;

  const hasAnyData =
    s.tests.length > 0 ||
    s.daily_tests.length > 0 ||
    weeks.some((w) => w.planner || w.att_marked > 0 || w.journal_days > 0);

  return {
    homework,
    attendance,
    journal,
    monthlyAttendance,
    tests,
    areas,
    weakArea,
    hasAnyData,
  };
}

/**
 * "이번 주 한 줄" — 숫자를 예쁘게 보여주는 것보다 "어디가 부족한지" 바로 알게.
 * 우선순위: 약점 영역 → 과제 하락 → 출석 하락 → 상승 칭찬 → 기본.
 */
export function buildInsight(d: DerivedStats): string {
  if (d.weakArea && d.weakArea.rate !== null && d.weakArea.rate < 70) {
    return `${d.weakArea.label} 정답률이 ${d.weakArea.rate}%로 가장 낮아요. ${d.weakArea.label} 지문 위주로 복습해봐요.`;
  }
  if (d.homework.delta !== null && d.homework.delta <= -10) {
    return "과제 수행률이 지난주보다 떨어졌어요. 밀린 과제부터 체크해봐요.";
  }
  if (d.attendance.delta !== null && d.attendance.delta <= -10) {
    return "출석률이 지난주보다 낮아졌어요. 다음 주는 빠지지 않는 걸 목표로!";
  }
  const ups = [
    d.homework.delta !== null && d.homework.delta >= 10 ? "과제 수행률" : null,
    d.attendance.delta !== null && d.attendance.delta >= 10 ? "출석률" : null,
    d.journal.delta !== null && d.journal.delta >= 10 ? "일지 작성률" : null,
    d.tests.delta !== null && d.tests.delta >= 5 ? "시험 점수" : null,
  ].filter((x): x is string => x !== null);
  if (ups.length > 0) return `${ups.join("·")}이 지난번보다 올랐어요. 이 흐름 그대로 가요!`;
  if (!d.hasAnyData) return "기록이 쌓이면 여기에 변화가 보여요.";
  return "꾸준히 잘 하고 있어요. 지금 페이스를 유지해요.";
}
