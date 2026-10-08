import { z } from 'zod';

/**
 * 학습 리포트(student_stats RPC) — jsonb 형태. SQL이 기준이고 여기는 파싱용.
 * 비율은 들어있지 않다(분자·분모만). 화면이 plannerRate()로 반올림한다.
 */

/** 최근 몇 주를 보여주는지 — SQL의 generate_series(7,0,-1)과 같이 움직인다 */
export const STATS_WEEKS = 8;
/** 시험 추이에 올리는 시트 수 — SQL limit 10 */
export const STATS_TEST_SHEETS = 10;
/** 영역별 성취도 집계 창(일) — SQL today-90 */
export const STATS_AREA_WINDOW_DAYS = 90;
/** 약점 영역으로 꼽으려면 최소 이만큼은 풀어봤어야 한다 */
export const AREA_MIN_QUESTIONS = 5;
/** 시험 추이 델타: 최근 N시트 평균 vs 그 이전 N시트 평균 */
export const TEST_DELTA_WINDOW = 3;

const statsTestSchema = z.object({
  sheet_id: z.string().uuid(),
  title: z.string(),
  date: z.string(),
  score: z.number(),
  total: z.number(),
  attempts: z.number(),
});

const statsWeekSchema = z.object({
  week_start: z.string(),
  planner: z.boolean(),
  hw_due: z.number(),
  hw_done: z.number(),
  hw_late: z.number(),
  hw_missed: z.number(),
  att_marked: z.number(),
  att_present: z.number(),
  att_late: z.number(),
  att_absent: z.number(),
  class_days: z.number(),
  journal_days: z.number(),
  journal_class_days: z.number(),
  weekdays_elapsed: z.number(),
});

const statsMonthSchema = z.object({
  month: z.string(),
  att_marked: z.number(),
  att_present: z.number(),
  att_late: z.number(),
  att_absent: z.number(),
  class_days: z.number(),
  journal_days: z.number(),
  journal_class_days: z.number(),
  weekdays_elapsed: z.number(),
});

const statsAreaSchema = z.object({
  source: z.string(),
  total: z.number(),
  correct: z.number(),
});

export const studentStatsSchema = z.object({
  student_id: z.string().uuid(),
  today: z.string(),
  week_start: z.string(),
  tests: z.array(statsTestSchema),
  daily_tests: z.array(z.object({ date: z.string(), score: z.number() })),
  weeks: z.array(statsWeekSchema),
  months: z.array(statsMonthSchema),
  areas: z.object({
    window_days: z.number(),
    current: z.array(statsAreaSchema),
    previous: z.array(statsAreaSchema),
  }),
});

export type StudentStats = z.infer<typeof studentStatsSchema>;
export type StatsWeek = z.infer<typeof statsWeekSchema>;
export type StatsMonth = z.infer<typeof statsMonthSchema>;
export type StatsTest = z.infer<typeof statsTestSchema>;
export type StatsArea = z.infer<typeof statsAreaSchema>;

// ── TOP3 랭킹 (top3_boards RPC + ranking_settings) ───────────────────────────

export const RANKING_NAME_DISPLAY = ['masked', 'full'] as const;
export type RankingNameDisplay = (typeof RANKING_NAME_DISPLAY)[number];
export const RANKING_NAME_DISPLAY_LABEL: Record<RankingNameDisplay, string> = {
  masked: '마스킹 (김○수)',
  full: '실명',
};

export const RANKING_SCOPE = ['all', 'group'] as const;
export type RankingScope = (typeof RANKING_SCOPE)[number];
export const RANKING_SCOPE_LABEL: Record<RankingScope, string> = {
  all: '학원 전체',
  group: '같은 그룹(반) 안에서',
};

export const RANKING_BOARD_KEYS = ['homework', 'attendance', 'growth', 'test'] as const;
export type RankingBoardKey = (typeof RANKING_BOARD_KEYS)[number];
export const RANKING_BOARD_LABEL: Record<RankingBoardKey, string> = {
  homework: '이번 주 과제 수행',
  attendance: '출석·성실도',
  growth: '가장 많이 성장',
  test: '시험 우수',
};

/**
 * 보드별 최소 참여 조건 — **SQL(top3_boards)이 기준**, 여기는 설정 화면 설명·빈 상태
 * 문구용. 바꾸려면 마이그레이션과 같이 바꾼다.
 */
export const TOP3_MIN = {
  homework_due: 3,
  attendance_marked: 3,
  growth_scores: 2,
  test_submitters: 3,
} as const;

const top3EntrySchema = z.object({
  rank: z.number(),
  name: z.string(),
  value_label: z.string(),
  is_me: z.boolean(),
});

const top3BoardSchema = z.object({
  key: z.enum(RANKING_BOARD_KEYS),
  title: z.string(),
  period_label: z.string(),
  subtitle: z.string().nullable(),
  entries: z.array(top3EntrySchema),
  me: z.object({ value_label: z.string().nullable(), qualified: z.boolean() }).nullable(),
  pool_size: z.number(),
});

export const top3BoardsSchema = z.object({
  settings: z.object({
    name_display: z.enum(RANKING_NAME_DISPLAY),
    scope: z.enum(RANKING_SCOPE),
    scope_label: z.string(),
  }),
  boards: z.array(top3BoardSchema),
});
export type Top3Boards = z.infer<typeof top3BoardsSchema>;
export type Top3Board = z.infer<typeof top3BoardSchema>;

/** 원장 설정 폼 입력 */
export const rankingSettingsInputSchema = z.object({
  nameDisplay: z.enum(RANKING_NAME_DISPLAY),
  scope: z.enum(RANKING_SCOPE),
  showHomework: z.boolean(),
  showAttendance: z.boolean(),
  showGrowth: z.boolean(),
  showTest: z.boolean(),
  featuredTestSheetId: z.string().uuid().nullable(),
});
export type RankingSettingsInput = z.infer<typeof rankingSettingsInputSchema>;
