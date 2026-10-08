"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendPoint = {
  /** YYYY-MM-DD */
  date: string;
  /** 온라인 시험 점수율(%) — 그 날 시트가 없으면 undefined */
  online?: number;
  title?: string;
  score?: number;
  total?: number;
  /** 일일 마킹 테스트 점수 — 없으면 undefined */
  daily?: number;
};

const fmtDate = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/**
 * 시험 점수 추이 — 온라인 시험(메인, 실선)과 일일 마킹 테스트(보조, 점선)를 한 축에.
 * 두 계열은 날짜가 다르므로 connectNulls로 잇는다.
 */
export function TestTrendChart({ points }: { points: TrendPoint[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={fmtDate} minTickGap={16} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}`} />
          <Tooltip
            labelFormatter={(v) => fmtDate(String(v))}
            formatter={(value, name, props) => {
              const p = props.payload as TrendPoint | undefined;
              if (name === "online") {
                const detail = p?.score != null && p?.total != null ? ` (${p.score}/${p.total})` : "";
                return [`${value}%${detail}${p?.title ? ` · ${p.title}` : ""}`, "온라인 시험"];
              }
              return [`${value}점`, "일일 테스트"];
            }}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 11 }}
            formatter={(v) => (v === "online" ? "온라인 시험(%)" : "일일 테스트(점)")}
          />
          <Line
            type="monotone"
            dataKey="daily"
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={{ r: 2 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="online"
            stroke="#e11d2e"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
