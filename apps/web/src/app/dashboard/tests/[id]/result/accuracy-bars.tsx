import { cn } from "@/lib/utils";

export type AccuracyRow = {
  label: string;
  total: number;
  correct: number;
  /** 강조(약점 등) */
  weak?: boolean;
};

/**
 * 정답률 가로 막대 — 영역·유형·난이도가 같이 쓴다. 서버 컴포넌트(차트 라이브러리 없이
 * 막대만). 분모가 0이면 그리지 않는다.
 */
export function AccuracyBars({ rows }: { rows: AccuracyRow[] }) {
  const visible = rows.filter((r) => r.total > 0);
  if (visible.length === 0) {
    return <p className="text-muted-foreground text-xs">집계할 문항이 없어요.</p>;
  }
  return (
    <ul className="space-y-2">
      {visible.map((r) => {
        const pct = Math.round((r.correct / r.total) * 100);
        return (
          <li key={r.label} className="text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={cn("truncate", r.weak && "text-primary font-bold")}>
                {r.label}
                {r.weak && <span className="ml-1 text-[10px]">약점</span>}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {pct}% ({r.correct}/{r.total})
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-2 rounded-full",
                  pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
