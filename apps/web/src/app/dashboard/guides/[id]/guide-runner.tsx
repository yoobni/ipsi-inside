"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, Puzzle } from "lucide-react";
import { GUIDE_STEP_KIND_LABEL, type GuidePassage, type GuideStepPayload } from "@ipsi/types";
import { cn } from "@/lib/utils";
import { PracticeButton } from "../../stats/practice-button";
import { completeGuideStepAction } from "../actions";

export type RunnerStep = {
  id: string;
  title: string;
  payload: GuideStepPayload;
  passage: GuidePassage | null;
  drill: { id: string; title: string; kind: string } | null;
};

export function GuideRunner({
  guideId, title, summary, workId, workTitle, steps, completed, canComplete, initialIdx,
}: {
  guideId: string;
  title: string;
  summary: string | null;
  workId: string | null;
  workTitle: string | null;
  steps: RunnerStep[];
  completed: string[];
  canComplete: boolean;
  initialIdx: number;
}) {
  const [idx, setIdx] = useState(initialIdx);
  const [done, setDone] = useState<Set<string>>(new Set(completed));
  const [pending, startTransition] = useTransition();
  const step = steps[idx]!;
  const isLast = idx === steps.length - 1;

  const completeAndNext = () => {
    if (!canComplete) { if (!isLast) setIdx(idx + 1); return; }
    startTransition(async () => {
      if (!done.has(step.id)) {
        const r = await completeGuideStepAction(guideId, step.id);
        if (r.ok) setDone(new Set([...done, step.id]));
      }
      if (!isLast) setIdx(idx + 1);
    });
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-hairline sticky top-0 z-10 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Link href="/dashboard/guides" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground">
            <ChevronLeft className="size-4" />가이드
          </Link>
          <span className="text-muted-foreground text-xs tabular-nums">{done.size}/{steps.length} 완료</span>
        </div>
        {/* 단계 점 */}
        <ol className="mx-auto mt-2 flex max-w-2xl gap-1">
          {steps.map((s, i) => (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`${i + 1}. ${s.title}`}
                aria-current={i === idx ? "step" : undefined}
                className={cn("h-1.5 w-full rounded-full transition-colors", done.has(s.id) ? "bg-primary" : i === idx ? "bg-primary/50" : "bg-muted")}
              />
            </li>
          ))}
        </ol>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6">
        <div>
          <p className="text-muted-foreground text-xs">{workTitle ? `${workTitle} · ` : ""}{title}</p>
          <p className="text-primary mt-1 text-[11px] font-bold">{idx + 1}단계 · {GUIDE_STEP_KIND_LABEL[step.payload.kind]}</p>
          <h1 className="font-display mt-0.5 text-[26px] leading-tight">{step.title}</h1>
          {idx === 0 && summary && <p className="text-muted-foreground mt-1 text-sm">{summary}</p>}
        </div>

        <StepBody step={step} workId={workId} canComplete={canComplete} />
      </main>

      <footer className="border-hairline sticky bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <button type="button" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
            className="border-hairline inline-flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-sm font-medium disabled:opacity-40">
            <ChevronLeft className="size-4" />이전
          </button>
          <button type="button" onClick={completeAndNext} disabled={pending}
            className="bg-primary text-primary-foreground inline-flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-bold disabled:opacity-60">
            {done.has(step.id) || !canComplete ? (isLast ? <><Check className="size-4" />끝</> : <>다음<ChevronRight className="size-4" /></>) : isLast ? <><Check className="size-4" />완료</> : <><Check className="size-4" />완료하고 다음</>}
          </button>
        </div>
      </footer>
    </div>
  );
}

function StepBody({ step, workId, canComplete }: { step: RunnerStep; workId: string | null; canComplete: boolean }) {
  const p = step.payload;
  if (p.kind === "intro" || p.kind === "summary" || p.kind === "review") {
    return (
      <div className="space-y-4">
        <Card><Html html={p.html} /></Card>
        {p.kind === "review" && (
          <Link href="/dashboard/stats" className="text-primary inline-flex items-center gap-1 text-sm font-bold hover:underline">
            내 리포트에서 틀린 유형 확인하기 <ChevronRight className="size-4" />
          </Link>
        )}
      </div>
    );
  }
  if (p.kind === "read") {
    if (!step.passage) return <Card><p className="text-muted-foreground text-sm">지문을 불러오지 못했어요.</p></Card>;
    return (
      <div className="space-y-3">
        {p.note && <p className="bg-primary/5 border-primary/30 rounded-md border p-3 text-sm">📌 {p.note}</p>}
        <Card>
          <p className="text-muted-foreground mb-2 text-xs">{step.passage.title}{step.passage.source ? ` · ${step.passage.source}` : ""}</p>
          <Html html={step.passage.content} className="text-[15px] leading-[1.9]" />
        </Card>
      </div>
    );
  }
  if (p.kind === "visual" || p.kind === "comic") {
    return (
      <div className="space-y-3">
        <div className={cn("grid gap-3", p.kind === "comic" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
          {p.images.map((im) => (
            <figure key={im.path} className="border-hairline bg-surface overflow-hidden rounded-[14px] border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt={im.caption ?? ""} className="w-full" loading="lazy" />
              {im.caption && <figcaption className="text-muted-foreground px-3 py-2 text-xs">{im.caption}</figcaption>}
            </figure>
          ))}
        </div>
        {p.html && <Card><Html html={p.html} /></Card>}
      </div>
    );
  }
  if (p.kind === "ox") {
    return (
      <Card>
        {step.drill ? (
          <div className="space-y-3">
            <p className="text-sm">짧게 점검해요. 틀린 건 바로 다시 나와요.</p>
            <Link href={`/dashboard/drills/${step.drill.id}`} className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold">
              <Puzzle className="size-4" />{step.drill.title} 풀기
            </Link>
            <p className="text-muted-foreground text-xs">다 풀고 돌아와서 &lsquo;완료하고 다음&rsquo;을 눌러요.</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">연결된 훈련이 아직 발행되지 않았어요.</p>
        )}
      </Card>
    );
  }
  // questions
  return (
    <Card>
      <div className="space-y-3">
        {p.note && <p className="text-sm">{p.note}</p>}
        {workId ? (
          canComplete ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm">이 작품 문항으로 {p.size}문제를 만들어 풀어요(채점·해설은 시험과 같아요).</p>
              <PracticeButton tagKind="work" tagId={workId} size={p.size} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">학생이 이 단계에서 보충 문제를 풀어요.</p>
          )
        ) : (
          <p className="text-muted-foreground text-sm">이 가이드에 작품이 지정되지 않아 문제를 만들 수 없어요.</p>
        )}
        <p className="text-muted-foreground text-xs">보충 세트는 하루 2개까지, 결과는 리포트의 성취도에 반영돼요.</p>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="border-hairline bg-surface rounded-[14px] border p-5">{children}</section>;
}
function Html({ html, className }: { html: string; className?: string }) {
  return <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
