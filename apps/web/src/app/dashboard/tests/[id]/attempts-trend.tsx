"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendPoint = {
  attempt_no: number;
  percent: number;
  score: number;
  total: number;
};

export function AttemptsTrend({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null;
  return (
    <section className="border-hairline rounded-[14px] border bg-surface p-5">
      <p className="text-foreground text-xs font-bold">회차별 점수 추세</p>
      <p className="text-muted-foreground mt-0.5 text-[10px]">
        가로축 = 회차, 세로축 = 점수율(%)
      </p>
      <div className="mt-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="attempt_no"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${v}회`}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(_v, _n, props) => {
                const p = props.payload as TrendPoint | undefined;
                if (!p) return ["", ""];
                return [`${p.percent}% (${p.score}/${p.total})`, "점수"];
              }}
              labelFormatter={(v) => `${v}회차`}
            />
            <Line
              type="monotone"
              dataKey="percent"
              stroke="#e11d2e"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
