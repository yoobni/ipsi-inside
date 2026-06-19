"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import type { QuestionChoice } from "@ipsi/types";
import { cn } from "@/lib/utils";

export type PreviewQuestion = {
  position: number; // 시험지 내 번호
  passage: { id: string; title: string; content: string } | null;
  position_in_passage: number;
  stem: string;
  supplementary: string | null;
  choices: QuestionChoice[];
  correct_answer: number;
  points: number;
};

/**
 * 시험지 학생 시점 미리보기 — 전체 시험지를 학생이 모바일에서 푸는 그대로 렌더.
 * 정답이 표시되는 admin 전용 보기 (학생 화면에는 정답 미노출).
 */
export function TestPreview({ questions }: { questions: PreviewQuestion[] }) {
  const [idx, setIdx] = useState(0);
  const total = questions.length;
  const q = questions[idx];

  if (!q)
    return (
      <p className="text-muted-foreground text-sm">미리볼 문항이 없어요.</p>
    );

  const sameAsPrev = idx > 0 && questions[idx - 1]?.passage?.id === q.passage?.id;

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Smartphone className="size-3.5" />
        학생 모바일 화면 미리보기 (정답 표시)
      </div>

      <div className="mx-auto w-[375px] rounded-[28px] border-[10px] border-zinc-900 bg-white shadow-2xl">
        {/* 상태바 */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[10px] font-semibold text-zinc-900">
          <span>9:41</span>
          <span>100%</span>
        </div>
        <div className="border-b border-zinc-100 px-4 py-3">
          <p className="text-[10px] font-semibold text-zinc-500">
            {idx + 1} / {total} 문항
          </p>
        </div>

        <div className="max-h-[600px] overflow-y-auto px-4 py-4">
          {q.passage && !sameAsPrev && (
            <section className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[10px] font-bold text-zinc-500 uppercase">지문</p>
              <p className="mt-0.5 text-sm font-bold text-zinc-900">
                {q.passage.title}
              </p>
              <div
                className="prose prose-sm prose-zinc max-w-none mt-2 text-[13.5px] leading-[1.7] text-zinc-800"
                dangerouslySetInnerHTML={{ __html: q.passage.content }}
              />
            </section>
          )}
          {q.passage && sameAsPrev && (
            <details className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50">
              <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-zinc-500">
                지문 다시 보기 — {q.passage.title}
              </summary>
              <div
                className="prose prose-sm prose-zinc max-w-none px-3 pb-3 text-[13px] leading-[1.7] text-zinc-800"
                dangerouslySetInnerHTML={{ __html: q.passage.content }}
              />
            </details>
          )}

          {q.supplementary && (
            <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-1.5 text-[10px] font-bold text-zinc-500">〈보기〉</p>
              <div
                className="prose prose-sm prose-zinc max-w-none text-[13px] leading-[1.6] text-zinc-800"
                dangerouslySetInnerHTML={{ __html: q.supplementary }}
              />
            </div>
          )}

          <p className="mb-1 text-[10px] font-bold text-red-600">
            {q.position}번 · {q.points}점
            <span className="ml-2 text-zinc-400">
              (지문 #{q.position_in_passage})
            </span>
          </p>
          <div
            className="prose prose-sm prose-zinc max-w-none text-[14px] font-medium leading-[1.65] text-zinc-900"
            dangerouslySetInnerHTML={{ __html: q.stem }}
          />

          <div className="mt-3 space-y-2">
            {q.choices.map((c) => {
              const isAnswer = c.no === q.correct_answer;
              return (
                <div
                  key={c.no}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border px-3 py-2",
                    isAnswer
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-zinc-200",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums",
                      isAnswer
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-zinc-300 text-zinc-700",
                    )}
                  >
                    {["", "①", "②", "③", "④", "⑤"][c.no]}
                  </span>
                  <div className="flex-1">
                    <div
                      className="prose prose-sm prose-zinc max-w-none text-[13px] leading-[1.55] text-zinc-800"
                      dangerouslySetInnerHTML={{ __html: c.text }}
                    />
                    {isAnswer && (
                      <p className="text-emerald-700 mt-1 text-[10px] font-bold">
                        ✓ 정답
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className={cn(
              "h-8 flex-1 rounded-md border border-zinc-200 text-xs font-medium text-zinc-700",
              idx === 0 && "opacity-40",
            )}
          >
            이전
          </button>
          <button
            type="button"
            disabled={idx >= total - 1}
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            className={cn(
              "h-8 flex-1 rounded-md bg-red-600 text-xs font-bold text-white",
              idx >= total - 1 && "opacity-40",
            )}
          >
            다음
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-1">
        {questions.map((qq, i) => (
          <button
            type="button"
            key={i}
            onClick={() => setIdx(i)}
            className={cn(
              "size-8 rounded-md border text-xs font-medium tabular-nums transition-colors",
              i === idx
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {qq.position}
          </button>
        ))}
      </div>
    </div>
  );
}
