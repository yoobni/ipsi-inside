import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StudentStats } from "@ipsi/types";
import { DeltaBadge } from "@/components/delta-badge";
import { buildInsight, deriveStats } from "@/lib/stats";

/**
 * 홈 카드 — 이번 주 요약(과제·출석·일지, 지난주 대비) + 한 줄 인사이트 + 리포트 링크.
 * 모바일엔 상단 내비가 없어서 이 카드가 /dashboard/stats 로 가는 유일한 입구다.
 */
export function WeeklyPulse({
  stats,
  studentName,
}: {
  stats: StudentStats;
  studentName?: string;
}) {
  const d = deriveStats(stats);
  if (!d.hasAnyData) return null;

  const tiles = [
    { label: "과제", v: d.homework },
    { label: "출석", v: d.attendance },
    { label: "일지", v: d.journal },
  ];

  return (
    <Link
      href="/dashboard/stats"
      className="border-hairline bg-surface hover:bg-muted/30 block rounded-[14px] border p-4 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">
            {studentName ? `${studentName}의 이번 주` : "이번 주 나는"}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{buildInsight(d)}</p>
        </div>
        <span className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-bold">
          리포트 보기 <ArrowRight className="size-3.5" />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="border-hairline rounded-[10px] border p-2.5">
            <p className="text-muted-foreground text-[11px]">{t.label}</p>
            <p className="mt-0.5 text-lg font-extrabold tabular-nums">
              {t.v.rate === null ? "–" : `${t.v.rate}%`}
            </p>
            {t.v.rate !== null && <DeltaBadge delta={t.v.delta} className="mt-0.5" />}
          </div>
        ))}
      </div>
    </Link>
  );
}
