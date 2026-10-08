import { Lightbulb } from "lucide-react";
import type { DerivedStats } from "@/lib/stats";
import { buildInsight } from "@/lib/stats";

/** "이번 주 한 줄" + 약점 영역 콜아웃 */
export function InsightCard({ d }: { d: DerivedStats }) {
  const insight = buildInsight(d);
  return (
    <section className="border-primary/30 bg-primary/5 rounded-[14px] border p-5">
      <div className="flex items-start gap-3">
        <Lightbulb className="text-primary mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold">이번 주 한 줄</p>
          <p className="text-sm leading-relaxed">{insight}</p>
          {d.weakArea && d.weakArea.rate !== null && (
            <p className="text-muted-foreground text-xs">
              약점 영역: <b className="text-foreground">{d.weakArea.label}</b> 정답률 {d.weakArea.rate}%
              ({d.weakArea.correct}/{d.weakArea.total}문항, 최근 90일)
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
