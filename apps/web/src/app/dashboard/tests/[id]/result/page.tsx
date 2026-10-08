import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Lightbulb } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import {
  ANALYSIS_WEAK_MIN,
  PASSAGE_SOURCE_LABEL,
  attemptAnalysisSchema,
  plannerRate,
  type AttemptAnalysis,
  type PassageSource,
} from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { DeltaBadge, deltaSentence } from "@/components/delta-badge";
import { AccuracyBars, type AccuracyRow } from "./accuracy-bars";
import { QuestionReview } from "./question-review";

export const dynamic = "force-dynamic";

/**
 * 시험 결과 — 점수만이 아니라 "어디가 부족한지": 직전 시험 대비, 영역·유형·난이도별
 * 정답률, 틀린 문항+해설, 최근 90일 반복 취약. 데이터는 attempt_analysis RPC 한 번
 * (제출된 응시만, 본인·학부모·담당 교직원 가드는 SQL 안에).
 */
export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const attemptId = sp.attempt;
  if (!attemptId) redirect(`/dashboard/tests/${id}`);

  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind !== "ok") redirect("/dashboard");

  const { data } = await supabase.rpc("attempt_analysis", { p_attempt_id: attemptId });
  const parsed = data == null ? null : attemptAnalysisSchema.safeParse(data);
  // null = 없는 응시 / 남의 응시 / 아직 제출 안 함 — 전부 상세로 돌려보낸다
  if (!parsed) redirect(`/dashboard/tests/${id}`);
  if (!parsed.success) notFound();
  const a: AttemptAnalysis = parsed.data;
  if (a.attempt.sheet_id !== id) notFound();

  const pct = plannerRate(a.attempt.score, a.attempt.total_points) ?? 0;
  const prevPct = a.previous ? plannerRate(a.previous.score, a.previous.total) : null;
  const delta = prevPct !== null ? pct - prevPct : null;
  const correctCount = a.questions.filter((q) => q.is_correct).length;

  const areaLabel = (s: string) => PASSAGE_SOURCE_LABEL[s as PassageSource] ?? s;
  const weakest = <T extends { total: number; correct: number }>(rows: T[]) =>
    rows
      .filter((r) => r.total >= ANALYSIS_WEAK_MIN)
      .sort((x, y) => x.correct / x.total - y.correct / y.total)[0] ?? null;

  // 이번 시험에서 가장 약한 유형(5문항 미만이면 영역으로)
  const weakTypeNow = weakest(a.by_type.filter((t) => t.type_id !== null));
  const weakAreaNow = weakest(a.by_area);
  // 최근 90일 반복 취약
  const weakTypeRecent = weakest(a.recent.by_type.filter((t) => t.type_id !== null));
  const weakAreaRecent = weakest(a.recent.by_area);

  const insight = (() => {
    const parts: string[] = [];
    if (delta !== null) parts.push(deltaSentence(delta, "직전 시험", "%p"));
    const w = weakTypeNow ?? weakAreaNow;
    if (w) {
      const label = "label" in w ? (w as { label: string }).label : areaLabel((w as { source: string }).source);
      parts.push(`이번 시험에서는 ${label}(${plannerRate(w.correct, w.total)}%)이 가장 약했어요.`);
    }
    const r = weakTypeRecent ?? weakAreaRecent;
    if (r && a.recent.sheets >= 2) {
      const label = "label" in r ? (r as { label: string }).label : areaLabel((r as { source: string }).source);
      parts.push(`최근 ${a.recent.sheets}개 시험을 모아 보면 ${label}이 반복해서 낮아요(${plannerRate(r.correct, r.total)}%).`);
    }
    return parts.length > 0 ? parts.join(" ") : "틀린 문항 해설부터 차근히 봐요.";
  })();

  const typeRows: AccuracyRow[] = a.by_type.map((t) => ({
    label: t.label,
    total: t.total,
    correct: t.correct,
    weak: weakTypeNow?.type_id != null && t.type_id === weakTypeNow.type_id,
  }));
  const areaRows: AccuracyRow[] = a.by_area.map((r) => ({
    label: areaLabel(r.source),
    total: r.total,
    correct: r.correct,
    weak: !weakTypeNow && weakAreaNow?.source === r.source,
  }));
  const diffRows: AccuracyRow[] = a.by_difficulty.map((d) => ({
    label: d.difficulty,
    total: d.total,
    correct: d.correct,
  }));
  const recentRows: AccuracyRow[] = (a.recent.by_type.length > 1 ? a.recent.by_type : a.recent.by_area.map((r) => ({ ...r, label: areaLabel(r.source), type_id: null })))
    .map((t) => ({
      label: t.label,
      total: t.total,
      correct: t.correct,
      weak: weakTypeRecent ? "type_id" in t && t.type_id === weakTypeRecent.type_id : weakAreaRecent?.source === (t as { source?: string }).source,
    }));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-background/80 px-6 py-4 backdrop-blur">
        <Wordmark size="md" />
        <ThemeToggle />
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
        <div>
          <Link
            href={`/dashboard/tests/${id}`}
            className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            시험 상세
          </Link>
          <h1 className="font-display mt-3 text-[28px] leading-tight">{a.attempt.sheet_title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {a.attempt.attempt_no}회차 ·{" "}
            {new Date(a.attempt.submitted_at).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* 점수 + 직전 대비 */}
        <section className="border-hairline rounded-[16px] border bg-surface p-6 text-center">
          <p className="text-muted-foreground text-xs font-bold">최종 점수</p>
          <p className="font-display text-primary mt-2 text-[56px] leading-none tabular-nums">
            {a.attempt.score}
            <span className="text-muted-foreground text-xl"> / {a.attempt.total_points}</span>
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            정답 {correctCount} / {a.questions.length}문항 <span className="ml-1">({pct}%)</span>
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs">
            {a.previous ? (
              <>
                <span className="text-muted-foreground">
                  직전 「{a.previous.title}」 {prevPct}% →
                </span>
                <DeltaBadge delta={delta} />
              </>
            ) : (
              <span className="text-muted-foreground">첫 시험이에요 — 다음 시험부터 변화가 보여요</span>
            )}
          </div>
        </section>

        {/* 한 줄 */}
        <section className="border-primary/30 bg-primary/5 rounded-[14px] border p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="text-primary mt-0.5 size-5 shrink-0" />
            <p className="text-sm leading-relaxed">{insight}</p>
          </div>
        </section>

        {/* 영역 · 유형 · 난이도 */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="영역별 정답률">
            <AccuracyBars rows={areaRows} />
          </Card>
          <Card title="난이도별 정답률">
            <AccuracyBars rows={diffRows} />
          </Card>
          <Card title="유형별 정답률" sub={a.by_type.some((t) => t.type_id === null) ? "유형이 지정되지 않은 문항은 '미분류'" : undefined} className="md:col-span-2">
            <AccuracyBars rows={typeRows} />
          </Card>
        </div>

        {/* 최근 90일 반복 취약 */}
        {a.recent.sheets >= 2 && (
          <Card
            title={`최근 ${a.recent.window_days}일 누적 (${a.recent.sheets}개 시험)`}
            sub="시험마다 가장 잘 본 응시 기준. 반복해서 낮은 곳이 진짜 약점이에요"
          >
            <AccuracyBars rows={recentRows} />
          </Card>
        )}

        <QuestionReview questions={a.questions} />
      </main>
    </div>
  );
}

function Card({ title, sub, className, children }: { title: string; sub?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={"border-hairline bg-surface rounded-[14px] border p-5 " + (className ?? "")}>
      <h2 className="text-sm font-extrabold">{title}</h2>
      {sub && <p className="text-muted-foreground mt-0.5 mb-3 text-[11px]">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </section>
  );
}
