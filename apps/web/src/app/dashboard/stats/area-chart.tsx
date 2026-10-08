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

export type AreaBar = {
  label: string;
  rate: number | null;
  prevRate: number | null;
  total: number;
  correct: number;
  isWeak: boolean;
};

/**
 * 영역별 정답률(가로 막대). 이전 90일은 얇은 회색 막대로 뒤에 깔아 변화가 보이게.
 * 약점 영역 막대는 진한 색.
 */
export function AreaChart({ areas }: { areas: AreaBar[] }) {
  const data = areas.map((a) => ({
    ...a,
    current: a.rate ?? 0,
    previous: a.prevRate ?? 0,
  }));
  return (
    <div style={{ height: 40 + areas.length * 44 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }} barGap={-18}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={88} />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.12)" }}
            formatter={(value, name, props) => {
              const a = props.payload as AreaBar | undefined;
              if (name === "current") {
                return [`${value}% (${a?.correct ?? 0}/${a?.total ?? 0})`, "최근 90일"];
              }
              return [a?.prevRate === null ? "기록 없음" : `${value}%`, "이전 90일"];
            }}
          />
          <Bar dataKey="previous" fill="#cbd5e1" radius={[0, 3, 3, 0]} barSize={8} />
          <Bar dataKey="current" radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((a) => (
              <Cell key={a.label} fill={a.isWeak ? "#e11d2e" : "#f08a94"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
