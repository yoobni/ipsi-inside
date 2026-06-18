"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RadarDatum = { unit: string; accuracy: number };
type BarDatum = { label: string; wrongRate: number; total: number };

export function ReportCharts({
  radarData,
  barData,
}: {
  radarData: RadarDatum[];
  barData: BarDatum[];
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {/* 레이더: 대단원별 정답률 */}
      <div className="border-hairline rounded-[14px] border bg-surface p-6">
        <h2 className="text-base font-extrabold">대단원별 정답률</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          영역별 강·약점을 한눈에
        </p>
        <div className="mt-4 h-[280px]">
          {radarData.length === 0 ? (
            <EmptyHint />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="var(--hairline)" />
                <PolarAngleAxis
                  dataKey="unit"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <Radar
                  name="정답률"
                  dataKey="accuracy"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.25}
                />
                <Tooltip
                  formatter={(v) => `${v}%`}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 막대: 단원별 오답률 (Top 8) */}
      <div className="border-hairline rounded-[14px] border bg-surface p-6">
        <h2 className="text-base font-extrabold">취약 단원 (오답률 Top)</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          소단원별 틀린 비율
        </p>
        <div className="mt-4 h-[280px]">
          {barData.length === 0 ? (
            <EmptyHint />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ left: 8, right: 16, top: 0, bottom: 0 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="var(--hairline)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  tick={{ fontSize: 11, fill: "var(--foreground)" }}
                />
                <Tooltip
                  formatter={(v) => `${v}% 오답`}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="wrongRate"
                  fill="var(--primary)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyHint() {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
      데이터가 없어요
    </div>
  );
}
