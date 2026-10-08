import type { AnalysisQuestion } from "@ipsi/types";
import { cn } from "@/lib/utils";

const CIRCLED = ["", "①", "②", "③", "④", "⑤"];

/**
 * 문항별 결과 — 틀린 문항은 펼쳐서 발문·〈보기〉·선지·해설까지 다시 본다.
 * 맞은 문항은 한 줄로 접어 둔다(복습의 초점은 틀린 것).
 */
export function QuestionReview({ questions }: { questions: AnalysisQuestion[] }) {
  const wrong = questions.filter((q) => q.is_correct !== true);
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-bold">
          틀린 문항 복습{" "}
          <span className="text-muted-foreground text-sm font-normal">{wrong.length}문항</span>
        </h2>
        {wrong.length === 0 ? (
          <p className="border-hairline bg-surface mt-3 rounded-[14px] border p-6 text-center text-sm">
            전부 맞혔어요. 🎉
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {wrong.map((q) => (
              <li key={q.question_id}>
                <details className="border-hairline bg-surface group rounded-[14px] border" open={wrong.length <= 3}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm">
                    <span className="bg-destructive/10 text-destructive inline-flex size-7 shrink-0 items-center justify-center rounded text-xs font-bold tabular-nums">
                      {q.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{q.passage_title}</p>
                      <p className="text-muted-foreground text-[11px]">
                        내 답 {q.selected != null ? CIRCLED[q.selected] : "—"} · 정답 {CIRCLED[q.correct_answer]}
                        {q.type_label ? ` · ${q.type_label}` : ""}
                        {q.difficulty ? ` · ${q.difficulty}` : ""}
                      </p>
                    </div>
                    <span className="text-muted-foreground text-xs group-open:hidden">펼치기</span>
                    <span className="text-muted-foreground hidden text-xs group-open:inline">접기</span>
                  </summary>
                  <div className="border-hairline space-y-3 border-t px-4 py-4">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: q.stem }}
                    />
                    {q.supplementary && (
                      <div className="border-hairline rounded-md border p-3">
                        <p className="text-muted-foreground mb-1 text-[11px] font-bold">〈보기〉</p>
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: q.supplementary }}
                        />
                      </div>
                    )}
                    <ol className="space-y-1.5">
                      {q.choices.map((c) => {
                        const isCorrect = c.no === q.correct_answer;
                        const isMine = c.no === q.selected;
                        return (
                          <li
                            key={c.no}
                            className={cn(
                              "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                              isCorrect && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
                              isMine && !isCorrect && "border-destructive bg-destructive/5",
                              !isCorrect && !isMine && "border-hairline",
                            )}
                          >
                            <span className="shrink-0 font-bold">{CIRCLED[c.no]}</span>
                            <span
                              className="prose prose-sm dark:prose-invert min-w-0 max-w-none flex-1"
                              dangerouslySetInnerHTML={{ __html: c.text }}
                            />
                            {isCorrect && <span className="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-300">정답</span>}
                            {isMine && !isCorrect && <span className="text-destructive shrink-0 text-xs font-bold">내 답</span>}
                          </li>
                        );
                      })}
                    </ol>
                    {q.explanation ? (
                      <div className="bg-primary/5 border-primary/30 rounded-md border p-3">
                        <p className="text-primary mb-1 text-[11px] font-bold">해설</p>
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: q.explanation }}
                        />
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs">해설 준비 중이에요.</p>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-bold">전체 문항</h2>
        <ul className="border-hairline bg-surface mt-3 divide-y rounded-[14px] border">
          {questions.map((q) => (
            <li key={q.question_id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="bg-muted text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded text-xs font-bold tabular-nums">
                {q.position}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{q.passage_title}</p>
                <p className="text-muted-foreground text-[11px]">
                  {q.type_label ?? "유형 미분류"}
                  {q.difficulty ? ` · ${q.difficulty}` : ""} · {q.points}점
                </p>
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">
                {q.selected != null ? CIRCLED[q.selected] : "—"} / {CIRCLED[q.correct_answer]}
              </span>
              <span
                className={
                  q.is_correct === true
                    ? "text-emerald-600 dark:text-emerald-400"
                    : q.is_correct === false
                      ? "text-destructive"
                      : "text-muted-foreground"
                }
              >
                {q.is_correct === true ? "✓" : q.is_correct === false ? "✕" : "–"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
