"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type WeekBar = {
  /** 주 시작(월) YYYY-MM-DD */
  week_start: string;
  /** 0–100, null = 그 주 데이터 없음(막대 없음) */
  rate: number | null;
  /** 툴팁 보조 설명 ("O 7 · △ 1 / 도래 9") */
  detail: string;
  isCurrent: boolean;
};

const fmtWeek = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/** 주별 비율 막대 8개 — 과제 수행률·출석률이 같이 쓴다. 이번 주는 진하게. */
export function WeeklyBarsChart({
  weeks,
  emptyLabel,
}: {
  weeks: WeekBar[];
  /** 데이터 없는 주의 툴팁 문구 (예: "플래너 없음") */
  emptyLabel: string;
}) {
  const data = weeks.map((w) => ({ ...w, value: w.rate ?? 0 }));
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week_start" tick={{ fontSize: 10 }} tickFormatter={fmtWeek} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.12)" }}
            labelFormatter={(v) => `${fmtWeek(String(v))} 주`}
            formatter={(_v, _n, props) => {
              const w = props.payload as WeekBar | undefined;
              if (!w || w.rate === null) return [emptyLabel, ""];
              return [`${w.rate}% · ${w.detail}`, ""];
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((w) => (
              <Cell
                key={w.week_start}
                fill={w.rate === null ? "transparent" : w.isCurrent ? "#e11d2e" : "#f08a94"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
