"use client";

import { DAY_LABELS, addDaysIso, minToHHMM } from "@ipsi/types";
import { cn } from "@/lib/utils";
import type { PlannerDay } from "./planner-week";

/**
 * 주간 타임테이블 (읽기 전용).
 *
 * 체크리스트만 있으면 "언제 무엇이 있는지"가 한눈에 안 들어온다. 원장 편집기와
 * 같은 격자를 학생·학부모에게도 보여주되, 두 가지를 다르게 한다:
 *   1) 국어 블록에 체크 진행률(2/3)을 얹는다 — 격자가 장식이 아니라 현황판이 된다
 *   2) 블록을 누르면 아래 체크리스트의 그 요일로 스크롤한다 — 두 뷰를 연결
 *
 * 폰이 주 사용처라 가로 스크롤을 전제로 한다(min-width). 시간 눈금을 44 → 38px로
 * 줄여 세로 길이도 함께 눌렀다.
 */

const HOUR_PX = 38;

/** Tailwind는 동적 클래스명을 못 뽑아내므로 색상은 정적 맵으로 (원장 편집기와 동일 팔레트) */
const FIXED_COLOR_CLASS: Record<string, string> = {
  slate:
    "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800/60 dark:border-slate-600 dark:text-slate-200",
  sky: "bg-sky-100 border-sky-300 text-sky-800 dark:bg-sky-950/50 dark:border-sky-700 dark:text-sky-200",
  emerald:
    "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-200",
  violet:
    "bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-950/50 dark:border-violet-700 dark:text-violet-200",
  rose: "bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-950/50 dark:border-rose-700 dark:text-rose-200",
};
const KOREAN_COLOR_CLASS =
  "bg-orange-100 border-orange-400 text-orange-900 dark:bg-orange-950/60 dark:border-orange-600 dark:text-orange-100";

export function PlannerTimetable({
  weekStart,
  today,
  days,
}: {
  weekStart: string;
  today: string;
  days: PlannerDay[];
}) {
  const allBlocks = days.flatMap((d) =>
    d.blocks.map((b) => ({ ...b, day_of_week: d.day_of_week, date: d.date })),
  );
  if (allBlocks.length === 0) return null;

  // 블록이 있는 시간대만 그린다. 하루 24시간을 다 그리면 대부분이 빈 칸이다.
  const min = Math.min(...allBlocks.map((b) => b.start_min));
  const max = Math.max(...allBlocks.map((b) => b.end_min));
  const startHour = Math.max(0, Math.floor(min / 60) - 1);
  const endHour = Math.min(24, Math.ceil(max / 60) + 1);
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i,
  );
  const gridHeight = (endHour - startHour) * HOUR_PX;

  const jumpToDay = (date: string) => {
    const el = document.getElementById(`planner-day-${date}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="border-hairline bg-surface overflow-x-auto rounded-[14px] border">
      <div className="min-w-[600px]">
        {/* 요일 머리 */}
        <div className="border-hairline grid grid-cols-[44px_repeat(7,1fr)] border-b">
          <div />
          {DAY_LABELS.map((label, i) => {
            const date = addDaysIso(weekStart, i);
            const isToday = date === today;
            return (
              <div
                key={label}
                className={cn(
                  "border-hairline border-l px-1 py-1.5 text-center text-[11px]",
                  isToday && "bg-primary/10",
                )}
              >
                <div className={cn("font-bold", isToday && "text-primary")}>
                  {label}
                </div>
                <div className="text-muted-foreground tabular-nums">
                  {date.slice(5).replace("-", "/")}
                </div>
              </div>
            );
          })}
        </div>

        {/* 본문 */}
        <div className="grid grid-cols-[44px_repeat(7,1fr)]">
          {/* 시간 눈금 */}
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className="text-muted-foreground absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums"
                style={{ top: i * HOUR_PX }}
              >
                {String(h).padStart(2, "0")}
              </div>
            ))}
          </div>

          {DAY_LABELS.map((label, dow) => {
            const date = addDaysIso(weekStart, dow);
            const isToday = date === today;
            return (
              <div
                key={label}
                className={cn(
                  "border-hairline relative border-l",
                  isToday && "bg-primary/5",
                )}
                style={{ height: gridHeight }}
              >
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="border-hairline/60 absolute inset-x-0 border-t border-dashed"
                    style={{ top: i * HOUR_PX }}
                  />
                ))}

                {allBlocks.map((b) => {
                  if (b.day_of_week !== dow) return null;
                  const top = ((b.start_min - startHour * 60) / 60) * HOUR_PX;
                  const height =
                    ((b.end_min - b.start_min) / 60) * HOUR_PX - 2;

                  const total = b.tasks.length;
                  const checked = b.tasks.filter(
                    (t) => t.status !== null,
                  ).length;

                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => jumpToDay(b.date)}
                      title={`${DAY_LABELS[dow]}요일 ${minToHHMM(b.start_min)}~${minToHHMM(b.end_min)} — 자세히 보기`}
                      className={cn(
                        "absolute inset-x-0.5 overflow-hidden rounded-md border px-1 py-0.5 text-left text-[10px] leading-tight transition-opacity hover:opacity-80",
                        b.kind === "korean"
                          ? KOREAN_COLOR_CLASS
                          : (FIXED_COLOR_CLASS[b.color ?? "slate"] ??
                            FIXED_COLOR_CLASS.slate),
                      )}
                      style={{ top, height: Math.max(height, 16) }}
                    >
                      <div className="truncate font-bold">
                        {b.kind === "korean" ? "국어" : b.label}
                      </div>
                      <div className="tabular-nums opacity-80">
                        {minToHHMM(b.start_min)}
                      </div>
                      {/* 진행률을 격자에 얹어야 현황판이 된다 */}
                      {b.kind === "korean" && total > 0 && (
                        <div className="mt-0.5 font-bold tabular-nums">
                          {checked}/{total}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
