"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type UnitStat = {
  unit_major: string;
  unit_minor: string | null;
  total: number;
  correct: number;
  accuracy: number;
};

export function ResultCharts({ unitStats }: { unitStats: UnitStat[] }) {
  const data = unitStats.map((u) => ({
    name: u.unit_minor
      ? `${u.unit_major} · ${u.unit_minor}`
      : u.unit_major,
    accuracy: u.accuracy,
    correct: u.correct,
    total: u.total,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11 }}
            width={120}
          />
          <Tooltip
            formatter={(value, name, props) => {
              if (name === "accuracy") {
                const { correct, total } = props.payload ?? {};
                return [`${value}% (${correct}/${total})`, "정답률"];
              }
              return [value, name];
            }}
          />
          <Bar dataKey="accuracy" fill="#e11d2e" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
