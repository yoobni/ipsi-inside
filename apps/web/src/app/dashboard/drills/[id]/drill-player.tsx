"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronLeft, RotateCcw, X } from "lucide-react";
import type { DrillAnswerResult, DrillFinish, DrillPlay, DrillPlayItem } from "@ipsi/types";
import { cn } from "@/lib/utils";
import { answerDrillAction, finishDrillAction, startDrillAction } from "../actions";

type Phase = "intro" | "play" | "done";
type Pending = { item: DrillPlayItem; result: DrillAnswerResult; answer: Record<string, unknown> } | null;

/**
 * 한 화면에 한 항목. 답하면 즉시 정오·해설. 틀린 항목은 큐 뒤에 다시 넣는다(전부 맞힐
 * 때까지). 점수는 첫 시도 기준(서버 finish_drill_attempt). 제한시간이 있으면 초과 시
 * 오답으로 자동 제출.
 */
export function DrillPlayer({ play }: { play: DrillPlay }) {
  const { drill, items } = play;
  const [phase, setPhase] = useState<Phase>("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [queue, setQueue] = useState<DrillPlayItem[]>(items);
  const [doneCount, setDoneCount] = useState(0); // 첫 시도 완료 수(진행률)
  const [firstTried, setFirstTried] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<Pending>(null);
  const [finish, setFinish] = useState<DrillFinish | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const startedAt = useRef<number>(Date.now());
  const [remaining, setRemaining] = useState<number | null>(null);

  const current = queue[0] ?? null;
  const total = items.length;

  // 제한시간 카운트다운
  useEffect(() => {
    if (phase !== "play" || !drill.time_limit_sec || !current || feedback) {
      setRemaining(null);
      return;
    }
    startedAt.current = Date.now();
    setRemaining(drill.time_limit_sec);
    const t = setInterval(() => {
      const left = drill.time_limit_sec! - Math.floor((Date.now() - startedAt.current) / 1000);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(t);
        submit({ timeout: true });
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current?.id, feedback]);

  const start = () =>
    startTransition(async () => {
      setError(null);
      const r = await startDrillAction(drill.id);
      if (!r.ok) return setError(r.message);
      setAttemptId(r.attemptId);
      startedAt.current = Date.now();
      setPhase("play");
    });

  const submit = (answer: Record<string, unknown>) => {
    if (!attemptId || !current || feedback) return;
    const elapsed = Date.now() - startedAt.current;
    startTransition(async () => {
      const r = await answerDrillAction(attemptId, current.id, answer, elapsed);
      if (!r.ok) return setError(r.message);
      setFeedback({ item: current, result: r.result, answer });
      if (!firstTried.has(current.id)) {
        setFirstTried(new Set([...firstTried, current.id]));
        setDoneCount((n) => n + 1);
      }
    });
  };

  const next = () => {
    if (!feedback) return;
    const wasCorrect = feedback.result.correct;
    const rest = queue.slice(1);
    // 틀렸으면 큐 뒤로 다시
    const nextQueue = wasCorrect ? rest : [...rest, feedback.item];
    setFeedback(null);
    if (nextQueue.length === 0) {
      startTransition(async () => {
        const r = await finishDrillAction(attemptId!);
        if (!r.ok) return setError(r.message);
        setFinish(r.result);
        setPhase("done");
      });
    } else {
      setQueue(nextQueue);
      startedAt.current = Date.now();
    }
  };

  const restart = () => {
    setQueue(items);
    setDoneCount(0);
    setFirstTried(new Set());
    setFeedback(null);
    setFinish(null);
    setPhase("intro");
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
        <Link href="/dashboard/drills" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground">
          <ChevronLeft className="size-4" />
          훈련 목록
        </Link>
        {phase === "play" && (
          <div className="flex items-center gap-3 text-xs">
            {remaining !== null && (
              <span className={cn("font-bold tabular-nums", remaining <= 3 && "text-destructive")}>⏱ {Math.max(0, remaining)}s</span>
            )}
            <span className="text-muted-foreground tabular-nums">{doneCount}/{total}</span>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6">
        {error && <p className="text-destructive mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p>}

        {phase === "intro" && (
          <div className="border-hairline bg-surface my-auto space-y-4 rounded-[16px] border p-6 text-center">
            <h1 className="font-display text-[28px] leading-tight">{drill.title}</h1>
            {drill.description && <p className="text-muted-foreground text-sm">{drill.description}</p>}
            <p className="text-muted-foreground text-xs">
              {total}문항{drill.time_limit_sec ? ` · 문항당 ${drill.time_limit_sec}초` : ""} · 틀린 건 바로 다시 나와요
            </p>
            <button type="button" onClick={start} disabled={pending} className="bg-primary text-primary-foreground w-full rounded-md px-4 py-3 text-sm font-bold disabled:opacity-60">
              {pending ? "준비 중..." : "시작하기"}
            </button>
          </div>
        )}

        {phase === "play" && current && (
          <div className="space-y-4">
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
            </div>
            <section className="border-hairline bg-surface rounded-[16px] border p-5">
              {firstTried.has(current.id) && !feedback && (
                <p className="text-primary mb-2 text-[11px] font-bold">다시 풀기</p>
              )}
              <p className="text-[17px] leading-relaxed font-medium whitespace-pre-wrap">{current.prompt}</p>
            </section>

            {!feedback ? (
              <ItemInput item={current} kind={drill.kind} disabled={pending} onSubmit={submit} />
            ) : (
              <Feedback fb={feedback} kind={drill.kind} onNext={next} pending={pending} isLast={queue.length === 1 && feedback.result.correct} />
            )}
          </div>
        )}

        {phase === "done" && finish && (
          <div className="border-hairline bg-surface my-auto space-y-4 rounded-[16px] border p-6 text-center">
            <p className="text-muted-foreground text-xs font-bold">첫 시도 기준</p>
            <p className="font-display text-primary text-[56px] leading-none tabular-nums">
              {finish.correct}
              <span className="text-muted-foreground text-xl"> / {finish.total}</span>
            </p>
            <p className="text-sm">
              {finish.correct === finish.total
                ? "한 번에 전부 맞혔어요! 🎉"
                : `${finish.wrong_item_ids.length}개는 다시 풀어서 맞혔어요. 내일 한 번 더 해봐요.`}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={restart} className="border-hairline inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-4 py-3 text-sm font-medium">
                <RotateCcw className="size-4" /> 다시 풀기
              </button>
              <Link href="/dashboard/drills" className="bg-primary text-primary-foreground inline-flex flex-1 items-center justify-center rounded-md px-4 py-3 text-sm font-bold">
                목록으로
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ItemInput({ item, kind, disabled, onSubmit }: { item: DrillPlayItem; kind: DrillPlay["drill"]["kind"]; disabled: boolean; onSubmit: (a: Record<string, unknown>) => void }) {
  const [assign, setAssign] = useState<(number | null)[]>([]);
  useEffect(() => {
    const tokens = (item.payload.tokens as string[] | undefined) ?? [];
    setAssign(tokens.map(() => null));
  }, [item.id, item.payload.tokens]);

  if (kind === "ox") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" disabled={disabled} onClick={() => onSubmit({ value: v })}
            className="border-hairline bg-surface hover:border-primary active:bg-primary/10 rounded-[16px] border py-8 text-4xl font-black transition-colors disabled:opacity-60">
            {v ? "O" : "X"}
          </button>
        ))}
      </div>
    );
  }
  if (kind === "choice") {
    const options = (item.payload.options as string[] | undefined) ?? [];
    return (
      <div className="space-y-2">
        {options.map((o, i) => (
          <button key={i} type="button" disabled={disabled} onClick={() => onSubmit({ index: i })}
            className="border-hairline bg-surface hover:border-primary flex w-full items-start gap-3 rounded-[12px] border px-4 py-3 text-left text-sm transition-colors disabled:opacity-60">
            <span className="shrink-0 font-bold">{["①", "②", "③", "④", "⑤"][i]}</span>
            <span>{o}</span>
          </button>
        ))}
      </div>
    );
  }
  const buckets = (item.payload.buckets as string[] | undefined) ?? [];
  const tokens = (item.payload.tokens as string[] | undefined) ?? [];
  const ready = assign.length === tokens.length && assign.every((a) => a !== null);
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {tokens.map((t, i) => (
          <li key={i} className="border-hairline bg-surface flex flex-wrap items-center gap-2 rounded-[12px] border px-3 py-2">
            <span className="min-w-[4rem] text-sm font-bold">{t}</span>
            <div className="ml-auto flex flex-wrap gap-1">
              {buckets.map((b, j) => (
                <button key={j} type="button" disabled={disabled} onClick={() => setAssign(assign.map((a, k) => (k === i ? j : a)))}
                  className={cn("rounded-full border px-2.5 py-1 text-xs", assign[i] === j ? "border-primary bg-primary text-primary-foreground font-bold" : "border-hairline text-muted-foreground")}>
                  {b}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" disabled={disabled || !ready} onClick={() => onSubmit({ assignments: assign })}
        className="bg-primary text-primary-foreground w-full rounded-md px-4 py-3 text-sm font-bold disabled:opacity-40">
        {ready ? "확인" : "모든 항목을 분류해주세요"}
      </button>
    </div>
  );
}

function Feedback({ fb, kind, onNext, pending, isLast }: { fb: NonNullable<Pending>; kind: DrillPlay["drill"]["kind"]; onNext: () => void; pending: boolean; isLast: boolean }) {
  const ok = fb.result.correct;
  const ans = fb.result.answer;
  const answerText = (() => {
    if (kind === "ox") return (ans.value as boolean) ? "O" : "X";
    if (kind === "choice") {
      const options = (fb.item.payload.options as string[] | undefined) ?? [];
      const i = ans.index as number;
      return `${["①", "②", "③", "④", "⑤"][i]} ${options[i] ?? ""}`;
    }
    const buckets = (fb.item.payload.buckets as string[] | undefined) ?? [];
    const tokens = (fb.item.payload.tokens as string[] | undefined) ?? [];
    const a = (ans.assignments as number[] | undefined) ?? [];
    return tokens.map((t, i) => `${t} → ${buckets[a[i] ?? 0] ?? ""}`).join(" · ");
  })();
  const timedOut = "timeout" in fb.answer;
  return (
    <div className={cn("space-y-3 rounded-[16px] border p-5", ok ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-destructive bg-destructive/5")}>
      <p className={cn("flex items-center gap-2 text-lg font-black", ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")}>
        {ok ? <Check className="size-5" /> : <X className="size-5" />}
        {ok ? "정답!" : timedOut ? "시간 초과" : "아쉬워요"}
        {fb.result.retry_no > 1 && <span className="text-muted-foreground ml-1 text-xs font-normal">({fb.result.retry_no}번째 시도)</span>}
      </p>
      <p className="text-sm"><span className="text-muted-foreground">정답: </span><b>{answerText}</b></p>
      {fb.result.explanation && <p className="text-sm leading-relaxed whitespace-pre-wrap">{fb.result.explanation}</p>}
      {!ok && <p className="text-muted-foreground text-xs">이 항목은 뒤에 다시 나와요.</p>}
      <button type="button" onClick={onNext} disabled={pending} className="bg-primary text-primary-foreground w-full rounded-md px-4 py-3 text-sm font-bold disabled:opacity-60">
        {pending ? "..." : isLast ? "결과 보기" : "다음"}
      </button>
    </div>
  );
}
