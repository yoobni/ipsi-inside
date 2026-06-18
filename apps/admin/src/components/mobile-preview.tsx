"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import type { QuestionInput, PassageInput } from "@ipsi/types";
import { cn } from "@/lib/utils";

type Props = {
  passage: Pick<PassageInput, "title" | "content">;
  questions: QuestionInput[];
};

/**
 * 학생이 모바일 시험 화면에서 어떻게 보는지를 미리보는 패널.
 * 좌측 입력 폼 옆에 sticky로 띄워서 라이브 렌더링.
 */
export function MobilePreview({ passage, questions }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const q = questions[currentIdx];
  const total = questions.length;

  return (
    <div className="sticky top-6 space-y-3">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Smartphone className="size-3.5" />
        학생 모바일 화면 미리보기
      </div>

      {/* iPhone-ish frame */}
      <div className="mx-auto w-[375px] rounded-[28px] border-[10px] border-zinc-900 bg-white shadow-2xl">
        {/* 상태바 (장식) */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[10px] font-semibold text-zinc-900">
          <span>9:41</span>
          <span className="flex items-center gap-0.5">
            <span className="size-1.5 rounded-full bg-zinc-900" />
            <span className="size-1.5 rounded-full bg-zinc-900" />
            <span className="size-1.5 rounded-full bg-zinc-900" />
            <span className="ml-1">100%</span>
          </span>
        </div>

        {/* 헤더 */}
        <div className="border-b border-zinc-100 px-4 py-3">
          <p className="text-[10px] font-semibold text-zinc-500">
            {total > 0 ? `${currentIdx + 1} / ${total} 문항` : "문항 없음"}
          </p>
          <p className="mt-0.5 truncate text-sm font-bold text-zinc-900">
            {passage.title || "지문 제목"}
          </p>
        </div>

        {/* 본문 (스크롤) */}
        <div className="max-h-[520px] overflow-y-auto px-4 py-4">
          {/* 지문 */}
          {passage.content ? (
            <section
              className="prose prose-sm prose-zinc max-w-none text-[13.5px] leading-[1.7] text-zinc-800"
              dangerouslySetInnerHTML={{ __html: passage.content }}
            />
          ) : (
            <p className="text-xs italic text-zinc-400">
              여기에 지문이 표시돼요.
            </p>
          )}

          {q && (
            <>
              <div className="my-4 border-t border-dashed border-zinc-200" />

              {/* 〈보기〉 */}
              {q.supplementary && (
                <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="mb-1.5 text-[10px] font-bold text-zinc-500">
                    〈보기〉
                  </p>
                  <div
                    className="prose prose-sm prose-zinc max-w-none text-[13px] leading-[1.6] text-zinc-800"
                    dangerouslySetInnerHTML={{ __html: q.supplementary }}
                  />
                </div>
              )}

              {/* 문제 본문 */}
              <p className="mb-2 text-[10px] font-bold text-red-600">
                {q.position_in_passage}번 · {q.points}점
              </p>
              {q.stem ? (
                <div
                  className="prose prose-sm prose-zinc max-w-none text-[14px] font-medium leading-[1.65] text-zinc-900"
                  dangerouslySetInnerHTML={{ __html: q.stem }}
                />
              ) : (
                <p className="text-xs italic text-zinc-400">문제 본문 자리</p>
              )}

              {/* 선지 */}
              <div className="mt-3 space-y-2">
                {q.choices.length === 0 && (
                  <p className="text-xs italic text-zinc-400">
                    선지를 입력하면 여기에 표시돼요.
                  </p>
                )}
                {q.choices.map((c) => (
                  <div
                    key={c.no}
                    className="flex items-start gap-2.5 rounded-lg border border-zinc-200 px-3 py-2"
                  >
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-bold text-zinc-700 tabular-nums">
                      {circled(c.no)}
                    </span>
                    {c.text ? (
                      <div
                        className="prose prose-sm prose-zinc max-w-none text-[13px] leading-[1.55] text-zinc-800"
                        dangerouslySetInnerHTML={{ __html: c.text }}
                      />
                    ) : (
                      <p className="text-xs italic text-zinc-400">선지 {c.no}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 푸터 (장식) */}
        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            className={cn(
              "h-8 flex-1 rounded-md border border-zinc-200 text-xs font-medium text-zinc-700",
              currentIdx === 0 && "opacity-40",
            )}
          >
            이전
          </button>
          <button
            type="button"
            disabled={currentIdx >= total - 1}
            onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
            className={cn(
              "h-8 flex-1 rounded-md bg-red-600 text-xs font-bold text-white",
              currentIdx >= total - 1 && "opacity-40",
            )}
          >
            다음
          </button>
        </div>
      </div>

      {/* 미리보기 안 문항 점프 */}
      {total > 1 && (
        <div className="flex flex-wrap justify-center gap-1">
          {questions.map((qq, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={cn(
                "size-7 rounded-md border text-xs font-medium tabular-nums transition-colors",
                i === currentIdx
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {qq.position_in_passage}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function circled(n: number): string {
  return ["", "①", "②", "③", "④", "⑤"][n] ?? String(n);
}
