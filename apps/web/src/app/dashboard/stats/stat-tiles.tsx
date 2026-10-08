import { DeltaBadge, deltaSentence } from "@/components/delta-badge";
import type { DerivedStats } from "@/lib/stats";

/** 상단 요약 타일 4개 — 과제·출석·일지(이번 주 vs 지난주), 최근 시험(최근 3 vs 이전 3) */
export function StatTiles({ d }: { d: DerivedStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile
        label="이번 주 과제 수행률"
        value={d.homework.rate}
        unit="%"
        delta={d.homework.delta}
        sentence={d.homework.rate === null ? "발행된 플래너가 없어요" : deltaSentence(d.homework.delta)}
      />
      <Tile
        label="이번 주 출석률"
        value={d.attendance.rate}
        unit="%"
        delta={d.attendance.delta}
        sentence={d.attendance.rate === null ? "아직 마킹된 날이 없어요" : deltaSentence(d.attendance.delta)}
      />
      <Tile
        label={`일지 작성률 · ${d.journal.basis === "class_days" ? "출석일 기준" : "평일 기준"}`}
        value={d.journal.rate}
        unit="%"
        delta={d.journal.delta}
        sentence={d.journal.rate === null ? "기준이 될 날이 아직 없어요" : deltaSentence(d.journal.delta)}
      />
      <Tile
        label="최근 시험 평균"
        value={d.tests.rate}
        unit="점"
        delta={d.tests.delta}
        deltaUnit="점"
        sentence={
          d.tests.rate === null
            ? "제출한 시험이 없어요"
            : deltaSentence(d.tests.delta, "이전 시험들", "점")
        }
      />
    </div>
  );
}

function Tile({
  label,
  value,
  unit,
  delta,
  deltaUnit = "%p",
  sentence,
}: {
  label: string;
  value: number | null;
  unit: string;
  delta: number | null;
  deltaUnit?: string;
  sentence: string;
}) {
  return (
    <div className="border-hairline bg-surface rounded-[14px] border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p className="flex items-baseline gap-1">
          <span className="font-display text-primary text-[32px] leading-none">
            {value === null ? "–" : value}
          </span>
          {value !== null && <span className="text-muted-foreground text-xs">{unit}</span>}
        </p>
        {value !== null && <DeltaBadge delta={delta} unit={deltaUnit} />}
      </div>
      <p className="text-muted-foreground mt-2 text-[11px] leading-snug">{sentence}</p>
    </div>
  );
}
