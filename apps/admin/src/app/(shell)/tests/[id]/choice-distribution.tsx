"use client";

import { useMemo, useState } from "react";
import { WRONG_FOCUS_SHARE, type ChoiceDistribution } from "@ipsi/types";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const CIRCLED = ["①", "②", "③", "④", "⑤"];

type Sort = "position" | "accuracy" | "focus";

/**
 * 문항별 선지 분포 — 학생들이 어떤 오답 선지에 많이 걸렸는지.
 * 정답 외 선지 하나에 WRONG_FOCUS_SHARE 이상 몰리면 "오답 집중"으로 표시한다.
 */
export function ChoiceDistributionPanel({ data }: { data: ChoiceDistribution }) {
  const [sort, setSort] = useState<Sort>("position");

  const rows = useMemo(() => {
    const enriched = data.questions.map((q) => {
      const total = q.total;
      const shares = q.counts.map((c) => (total > 0 ? c / total : 0));
      const accuracy = total > 0 ? Math.round((q.correct / total) * 100) : null;
      let focusNo: number | null = null;
      let focusShare = 0;
      shares.forEach((s, i) => {
        const no = i + 1;
        if (no !== q.correct_answer && s > focusShare) {
          focusShare = s;
          focusNo = no;
        }
      });
      return { ...q, shares, accuracy, focusNo: focusShare >= WRONG_FOCUS_SHARE ? focusNo : null, focusShare };
    });
    const sorted = enriched.slice();
    if (sort === "accuracy") sorted.sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101));
    else if (sort === "focus") sorted.sort((a, b) => b.focusShare - a.focusShare);
    return sorted;
  }, [data, sort]);

  if (data.respondents === 0) {
    return (
      <p className="text-muted-foreground px-4 py-6 text-center text-sm">
        아직 제출한 학생이 없어요.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="text-muted-foreground text-xs">
          응답 {data.respondents}명 · 학생별 첫 제출 응시 기준(결과를 본 뒤의 재응시는 제외)
        </p>
        <Tabs value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <TabsList>
            <TabsTrigger value="position">문항 순</TabsTrigger>
            <TabsTrigger value="accuracy">정답률 낮은 순</TabsTrigger>
            <TabsTrigger value="focus">오답 집중 순</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <ul className="divide-y border-t">
        {rows.map((q) => (
          <li key={q.question_id} className="space-y-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="bg-muted text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded text-xs font-bold tabular-nums">
                {q.position}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {q.passage_title} <span className="text-foreground/70">#{q.position_in_passage}</span>
              </span>
              {q.type_label && <Badge variant="outline">{q.type_label}</Badge>}
              {q.difficulty && <Badge variant="outline">{q.difficulty}</Badge>}
              <span className="ml-auto text-xs tabular-nums">
                정답률 {q.accuracy != null ? `${q.accuracy}%` : "—"}
                <span className="text-muted-foreground ml-1">({q.correct}/{q.total})</span>
              </span>
              {q.focusNo && (
                <Badge variant="warning">
                  오답 집중 {CIRCLED[q.focusNo - 1]} {Math.round(q.focusShare * 100)}%
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
              {q.counts.map((c, i) => {
                const no = i + 1;
                const isCorrect = no === q.correct_answer;
                const pct = Math.round(q.shares[i]! * 100);
                return (
                  <div key={no} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={cn("font-bold", isCorrect && "text-emerald-700 dark:text-emerald-300")}>
                        {CIRCLED[i]}
                        {isCorrect && " 정답"}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{pct}%</span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          "h-2 rounded-full",
                          isCorrect ? "bg-emerald-500" : q.focusNo === no ? "bg-amber-500" : "bg-slate-400",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-muted-foreground text-[10px] tabular-nums">{c}명</p>
                  </div>
                );
              })}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">미응답</span>
                  <span className="text-muted-foreground tabular-nums">
                    {q.total > 0 ? Math.round((q.unanswered / q.total) * 100) : 0}%
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="h-2 rounded-full bg-slate-300"
                    style={{ width: `${q.total > 0 ? Math.round((q.unanswered / q.total) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-[10px] tabular-nums">{q.unanswered}명</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
