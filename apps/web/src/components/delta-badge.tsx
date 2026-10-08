import { cn } from "@/lib/utils";

/**
 * 변화량 표시 — ▲ 초록 / ▼ 빨강 / 비슷하면 회색. null이면 "비교 기록 없음".
 * unit은 "%p"(비율) 또는 "점"(점수).
 */
export function DeltaBadge({
  delta,
  unit = "%p",
  className,
}: {
  delta: number | null;
  unit?: string;
  className?: string;
}) {
  if (delta === null) {
    return (
      <span className={cn("text-muted-foreground text-[11px]", className)}>
        비교 기록 없음
      </span>
    );
  }
  if (Math.abs(delta) < 1) {
    return (
      <span className={cn("text-muted-foreground text-[11px] font-bold", className)}>
        – 비슷해요
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
        up
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
        className,
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(delta)}
      {unit}
    </span>
  );
}

/** "지난주보다 12%p 올랐어요" 문장형 */
export function deltaSentence(
  delta: number | null,
  compare = "지난주",
  unit = "%p",
): string {
  if (delta === null) return `${compare} 기록이 없어 비교할 수 없어요`;
  if (Math.abs(delta) < 1) return `${compare}와 비슷해요`;
  return delta > 0
    ? `${compare}보다 ${delta}${unit} 올랐어요`
    : `${compare}보다 ${Math.abs(delta)}${unit} 내려갔어요`;
}
