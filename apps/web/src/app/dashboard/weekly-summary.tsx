import { cn } from "@/lib/utils";

type Attendance = "present" | "late" | "absent" | null;
type HomeworkGrade = "S" | "A" | "B" | "F" | null;

export type DailyRecord = {
  date: string;
  attendance: Attendance;
  homework_grade: HomeworkGrade;
  test_score: number | null;
};

export function WeeklySummary({
  days,
  studentName,
}: {
  /** 최근 N일분 (오늘 포함). 날짜 오름차순 */
  days: { date: string; record: DailyRecord | null }[];
  studentName?: string;
}) {
  const presentCount = days.filter((d) => d.record?.attendance === "present").length;
  const lateCount = days.filter((d) => d.record?.attendance === "late").length;
  const absentCount = days.filter((d) => d.record?.attendance === "absent").length;
  const attendanceCount = presentCount + lateCount + absentCount;

  const homeworkScores = days
    .map((d) => homeworkGradeToScore(d.record?.homework_grade))
    .filter((v): v is number => v !== null);
  const homeworkAvg =
    homeworkScores.length > 0
      ? Math.round(
          (homeworkScores.reduce((a, b) => a + b, 0) / homeworkScores.length) * 10,
        ) / 10
      : null;

  const testScores = days
    .map((d) => d.record?.test_score)
    .filter((v): v is number => v != null);
  const testAvg =
    testScores.length > 0
      ? Math.round(
          (testScores.reduce((a, b) => a + b, 0) / testScores.length) * 10,
        ) / 10
      : null;

  return (
    <section className="border-hairline rounded-[16px] border bg-surface p-7 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold">최근 7일 학습 요약</h2>
          {studentName && (
            <p className="text-muted-foreground text-xs mt-0.5">{studentName}</p>
          )}
        </div>
      </div>

      {/* 한 줄 7일 dot 그리드 */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const dt = new Date(`${d.date}T00:00:00Z`);
          const weekday = ["일", "월", "화", "수", "목", "금", "토"][dt.getUTCDay()];
          const day = dt.getUTCDate();
          return (
            <div key={d.date} className="text-center">
              <div className="text-muted-foreground text-[10px]">{weekday}</div>
              <div className="text-foreground text-xs font-medium tabular-nums">
                {day}
              </div>
              <div className="mt-1.5 flex flex-col items-center gap-1">
                <AttendanceDot value={d.record?.attendance ?? null} />
                <HomeworkBadge value={d.record?.homework_grade ?? null} />
                <TestScoreBadge value={d.record?.test_score ?? null} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 집계 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryStat
          label="출석률"
          value={
            attendanceCount === 0
              ? "-"
              : `${Math.round(((presentCount + lateCount * 0.5) / attendanceCount) * 100)}%`
          }
          sub={`출${presentCount} 지${lateCount} 결${absentCount}`}
        />
        <SummaryStat
          label="과제 평균"
          value={homeworkAvg !== null ? scoreToGrade(homeworkAvg) : "-"}
          sub={
            homeworkScores.length > 0
              ? `${homeworkScores.length}회 기록`
              : "기록 없음"
          }
        />
        <SummaryStat
          label="테스트 평균"
          value={testAvg !== null ? `${testAvg}점` : "-"}
          sub={testScores.length > 0 ? `${testScores.length}회` : "기록 없음"}
        />
        <SummaryStat
          label="기록 일수"
          value={`${
            days.filter((d) => d.record !== null).length
          } / ${days.length}`}
          sub="최근 7일"
        />
      </div>
    </section>
  );
}

function AttendanceDot({ value }: { value: Attendance }) {
  if (value === "present")
    return <span className="size-2.5 rounded-full bg-emerald-500" title="출석" />;
  if (value === "late")
    return <span className="size-2.5 rounded-full bg-amber-500" title="지각" />;
  if (value === "absent")
    return <span className="size-2.5 rounded-full bg-red-500" title="결석" />;
  return <span className="bg-muted-foreground/20 size-2.5 rounded-full" />;
}

function HomeworkBadge({ value }: { value: HomeworkGrade }) {
  if (!value)
    return (
      <span className="text-muted-foreground/40 text-[10px] font-bold">-</span>
    );
  const cls = {
    S: "text-emerald-600 dark:text-emerald-400",
    A: "text-blue-600 dark:text-blue-400",
    B: "text-amber-600 dark:text-amber-400",
    F: "text-red-600 dark:text-red-400",
  }[value];
  return <span className={cn("text-[10px] font-bold", cls)}>{value}</span>;
}

function TestScoreBadge({ value }: { value: number | null }) {
  if (value == null)
    return <span className="text-muted-foreground/40 text-[10px]">-</span>;
  return (
    <span className="text-foreground text-[10px] tabular-nums font-medium">
      {value}
    </span>
  );
}

function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="border-hairline rounded-[10px] border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-extrabold">{value}</p>
      <p className="text-muted-foreground mt-0.5 text-[10px]">{sub}</p>
    </div>
  );
}

function homeworkGradeToScore(g: HomeworkGrade | undefined): number | null {
  if (g === "S") return 4;
  if (g === "A") return 3;
  if (g === "B") return 2;
  if (g === "F") return 0;
  return null;
}

function scoreToGrade(score: number): string {
  if (score >= 3.5) return "S";
  if (score >= 2.5) return "A";
  if (score >= 1.5) return "B";
  return "F";
}
