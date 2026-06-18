"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid3x3,
  Loader2,
  X,
} from "lucide-react";
import type { QuestionChoice } from "@ipsi/types";
import { cn } from "@/lib/utils";
import { saveAnswerAction, submitAttemptAction } from "../../actions";

export type ExamQuestion = {
  position: number; // 시험지 내 번호
  question_id: string;
  passage: { id: string; title: string; content: string } | null;
  position_in_passage: number;
  stem: string;
  supplementary: string | null;
  choices: QuestionChoice[];
  points: number;
};

export function ExamRunner({
  attemptId,
  testSheetId,
  title,
  dueAt,
  questions,
  initialAnswers,
}: {
  attemptId: string;
  testSheetId: string;
  title: string;
  dueAt: string | null;
  questions: ExamQuestion[];
  initialAnswers: Record<string, number | null>;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>(
    initialAnswers,
  );
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [navOpen, setNavOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitPending, startSubmitTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 남은 시간 (due_at 있을 때만)
  const [remainingMs, setRemainingMs] = useState<number | null>(
    dueAt ? new Date(dueAt).getTime() - Date.now() : null,
  );
  useEffect(() => {
    if (!dueAt) return;
    const t = setInterval(() => {
      setRemainingMs(new Date(dueAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [dueAt]);

  const q = questions[idx];
  const total = questions.length;
  const answeredCount = useMemo(
    () =>
      questions.filter(
        (qq) => answers[qq.question_id] != null,
      ).length,
    [questions, answers],
  );

  const handleSelect = (questionId: string, selected: number) => {
    setAnswers((p) => ({ ...p, [questionId]: selected }));
    setSavingIds((p) => {
      const next = new Set(p);
      next.add(questionId);
      return next;
    });
    // fire-and-forget save
    void saveAnswerAction(attemptId, questionId, selected).then((r) => {
      setSavingIds((p) => {
        const next = new Set(p);
        next.delete(questionId);
        return next;
      });
      if (!r.ok) {
        console.error("save failed", r.message);
      }
    });
  };

  const handleClear = (questionId: string) => {
    setAnswers((p) => ({ ...p, [questionId]: null }));
    void saveAnswerAction(attemptId, questionId, null);
  };

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(total - 1, i + 1));

  const handleSubmit = () => {
    setSubmitError(null);
    startSubmitTransition(async () => {
      const r = await submitAttemptAction(attemptId);
      if (r.ok) {
        router.push(`/dashboard/tests/${testSheetId}/result?attempt=${attemptId}`);
      } else {
        setSubmitError(r.message);
        setConfirmOpen(false);
      }
    });
  };

  const sameAsPrev =
    idx > 0 && questions[idx - 1]?.passage?.id === q?.passage?.id;

  if (!q) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">문항이 없어요.</p>
      </main>
    );
  }

  const unanswered = total - answeredCount;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-hairline bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="border-hairline text-muted-foreground inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
          >
            <Grid3x3 className="size-3.5" />
            {idx + 1} / {total}
          </button>
          <h1 className="font-display flex-1 truncate text-sm">{title}</h1>
          {remainingMs != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums",
                remainingMs < 5 * 60 * 1000
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "text-muted-foreground",
              )}
            >
              <Clock className="size-3" />
              {formatRemaining(remainingMs)}
            </span>
          )}
        </div>
        {/* 진행률 바 */}
        <div className="mx-auto mt-2 max-w-3xl">
          <div className="bg-muted h-1 overflow-hidden rounded-full">
            <div
              className="bg-primary h-1 transition-all"
              style={{ width: `${(answeredCount / total) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {/* 지문 (이전 문항과 같은 지문이면 접기) */}
        {q.passage && !sameAsPrev && (
          <section className="border-hairline mb-6 rounded-[14px] border bg-surface p-5">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
              지문
            </p>
            <h2 className="mt-1 text-sm font-bold">{q.passage.title}</h2>
            <div
              className="prose prose-sm dark:prose-invert max-w-none mt-3 text-[14px] leading-[1.7]"
              dangerouslySetInnerHTML={{ __html: q.passage.content }}
            />
          </section>
        )}
        {q.passage && sameAsPrev && (
          <details className="border-hairline mb-6 rounded-[14px] border bg-surface">
            <summary className="cursor-pointer px-5 py-3 text-xs font-bold text-muted-foreground hover:text-foreground">
              지문 다시 보기 — {q.passage.title}
            </summary>
            <div
              className="prose prose-sm dark:prose-invert max-w-none px-5 pb-5 text-[14px] leading-[1.7]"
              dangerouslySetInnerHTML={{ __html: q.passage.content }}
            />
          </details>
        )}

        {/* 〈보기〉 */}
        {q.supplementary && (
          <section className="border-hairline mb-4 rounded-[12px] border bg-muted/30 p-4">
            <p className="text-muted-foreground mb-1.5 text-[10px] font-bold">
              〈보기〉
            </p>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-[13.5px] leading-[1.65]"
              dangerouslySetInnerHTML={{ __html: q.supplementary }}
            />
          </section>
        )}

        {/* 문제 */}
        <section>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-primary text-[28px]">
              {q.position}
            </span>
            <span className="text-muted-foreground text-xs">
              · {q.points}점
            </span>
            {savingIds.has(q.question_id) && (
              <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 text-[10px]">
                <Loader2 className="size-3 animate-spin" />
                저장 중
              </span>
            )}
          </div>
          <div
            className="prose prose-sm dark:prose-invert max-w-none mt-1 text-[15px] font-medium leading-[1.7]"
            dangerouslySetInnerHTML={{ __html: q.stem }}
          />

          {/* 선지 */}
          <div className="mt-4 space-y-2">
            {q.choices.map((c) => {
              const selected = answers[q.question_id] === c.no;
              return (
                <button
                  key={c.no}
                  type="button"
                  onClick={() => handleSelect(q.question_id, c.no)}
                  className={cn(
                    "border-hairline flex w-full items-start gap-3 rounded-[12px] border bg-surface px-4 py-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "hover:border-foreground/20",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold tabular-nums",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-foreground/20 text-muted-foreground",
                    )}
                  >
                    {["", "①", "②", "③", "④", "⑤"][c.no]}
                  </span>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none flex-1 text-[14px] leading-[1.6]"
                    dangerouslySetInnerHTML={{ __html: c.text }}
                  />
                </button>
              );
            })}
          </div>

          {answers[q.question_id] != null && (
            <button
              type="button"
              onClick={() => handleClear(q.question_id)}
              className="text-muted-foreground mt-3 text-xs hover:underline"
            >
              선택 취소
            </button>
          )}
        </section>
      </main>

      {/* 푸터 */}
      <footer className="sticky bottom-0 border-t border-hairline bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={idx === 0}
            className="border-hairline inline-flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
            이전
          </button>
          {idx < total - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="bg-primary text-primary-foreground inline-flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-bold"
            >
              다음
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="bg-primary text-primary-foreground inline-flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-bold"
            >
              <Check className="size-4" />
              제출하기
            </button>
          )}
        </div>
      </footer>

      {/* 네비게이션 (문항 점프) */}
      {navOpen && (
        <NavPanel
          questions={questions}
          answers={answers}
          currentIdx={idx}
          onPick={(i) => {
            setIdx(i);
            setNavOpen(false);
          }}
          onClose={() => setNavOpen(false)}
        />
      )}

      {/* 제출 확인 */}
      {confirmOpen && (
        <ConfirmSubmit
          totalQ={total}
          answeredCount={answeredCount}
          unanswered={unanswered}
          pending={submitPending}
          error={submitError}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleSubmit}
        />
      )}
    </div>
  );
}

function NavPanel({
  questions,
  answers,
  currentIdx,
  onPick,
  onClose,
}: {
  questions: ExamQuestion[];
  answers: Record<string, number | null>;
  currentIdx: number;
  onPick: (i: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[20px] bg-background p-6 sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">문항 이동</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {questions.map((qq, i) => {
            const answered = answers[qq.question_id] != null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(i)}
                className={cn(
                  "size-10 rounded-md border text-sm font-bold tabular-nums transition-colors",
                  i === currentIdx
                    ? "border-primary bg-primary text-primary-foreground"
                    : answered
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-hairline text-muted-foreground hover:bg-muted",
                )}
              >
                {qq.position}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ConfirmSubmit({
  totalQ,
  answeredCount,
  unanswered,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  totalQ: number;
  answeredCount: number;
  unanswered: number;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-[20px] bg-background p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg">시험을 제출할까요?</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          제출하면 점수가 자동 채점돼요.
          {unanswered > 0 && (
            <>
              <br />
              <strong className="text-amber-600 dark:text-amber-400">
                미응답 {unanswered}문항
              </strong>
              이 있어요.
            </>
          )}
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          진행: {answeredCount} / {totalQ}
        </p>

        {error && (
          <p className="text-destructive mt-3 text-sm">{error}</p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="border-hairline flex-1 rounded-md border bg-background py-2.5 text-sm font-medium disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-primary text-primary-foreground flex-1 rounded-md py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {pending ? "처리 중..." : "제출"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "마감";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}

