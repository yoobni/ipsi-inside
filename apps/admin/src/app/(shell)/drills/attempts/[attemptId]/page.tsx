import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { DRILL_KIND_LABEL, type DrillKind } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { AckButton } from "./ack-button";

export const dynamic = "force-dynamic";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 정답을 사람이 읽을 글로 — kind 별 answer/payload 모양은 packages/types/src/drills.ts */
function answerText(kind: DrillKind, payload: Record<string, unknown>, answer: Record<string, unknown>): string {
  if (kind === "ox") return answer.value ? "O" : "X";
  if (kind === "choice") {
    const options = (payload.options as string[] | undefined) ?? [];
    const idx = typeof answer.index === "number" ? answer.index : -1;
    return options[idx] != null ? `${idx + 1}. ${options[idx]}` : "-";
  }
  const buckets = (payload.buckets as string[] | undefined) ?? [];
  const tokens = (payload.tokens as string[] | undefined) ?? [];
  const asg = (answer.assignments as number[] | undefined) ?? [];
  return tokens.map((t, i) => `${t} → ${buckets[asg[i] ?? -1] ?? "?"}`).join(", ");
}

/**
 * 학생이 보낸 훈련 결과 상세 — 첫 시도에서 틀린 항목과 재시도 여부, 학생 메모.
 * 응시·항목 결과는 staff RLS(담당 범위)로 걸러진다. 보내지 않은 응시는 여기로 못 온다(링크가 없음)지만
 * URL 을 직접 치면 보여도 된다 — 어차피 담당 학생의 기록이다.
 */
export default async function DrillAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: attempt } = await supabase
    .from("drill_attempts")
    .select("id, student_id, drill_id, started_at, finished_at, correct, total, shared_at, share_note, share_ack_by, share_ack_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) notFound();

  const [{ data: student }, { data: drill }, { data: items }, { data: results }, { data: acker }] = await Promise.all([
    supabase.from("profiles").select("full_name, school, grade").eq("id", attempt.student_id).maybeSingle(),
    supabase.from("drills").select("title, kind").eq("id", attempt.drill_id).maybeSingle(),
    supabase.from("drill_items").select("id, position, prompt, payload, answer, explanation").eq("drill_id", attempt.drill_id).order("position"),
    supabase.from("drill_item_results").select("item_id, retry_no, correct, elapsed_ms").eq("attempt_id", attemptId).order("answered_at"),
    attempt.share_ack_by
      ? supabase.from("profiles").select("full_name").eq("id", attempt.share_ack_by).maybeSingle()
      : Promise.resolve({ data: null as { full_name: string } | null }),
  ]);
  const kind = (drill?.kind ?? "ox") as DrillKind;

  // 항목별: 첫 시도 정오 + 재시도 횟수
  const byItem = new Map<string, { first: boolean | null; retries: number; firstMs: number | null }>();
  (results ?? []).forEach((r) => {
    const cur = byItem.get(r.item_id) ?? { first: null, retries: 0, firstMs: null };
    if (r.retry_no === 1) {
      cur.first = r.correct;
      cur.firstMs = r.elapsed_ms;
    } else cur.retries += 1;
    byItem.set(r.item_id, cur);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link href="/drills" className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline">
          <ArrowLeft className="size-3" />
          OX 훈련
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight break-all">{drill?.title ?? "훈련"}</h1>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
              <span className="text-foreground font-medium">{student?.full_name ?? "학생"}</span>
              {student?.school && <span>{student.school}{student.grade ? ` ${student.grade}학년` : ""}</span>}
              <span>· {DRILL_KIND_LABEL[kind]}</span>
              {attempt.finished_at && <span>· {fmt(attempt.finished_at)} 완료</span>}
            </p>
          </div>
          {attempt.shared_at &&
            (attempt.share_ack_at ? (
              <Badge variant="success" className="self-start">
                <Check className="size-3" />
                {acker?.full_name ?? "교직원"} 확인 · {fmt(attempt.share_ack_at)}
              </Badge>
            ) : (
              <AckButton attemptId={attemptId} />
            ))}
        </div>
      </div>

      <div className="bg-card flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center">
        <div className="text-center sm:w-32">
          <p className="text-muted-foreground text-xs font-bold">첫 시도</p>
          <p className="text-primary text-4xl font-bold tabular-nums">
            {attempt.correct ?? 0}
            <span className="text-muted-foreground text-lg"> / {attempt.total ?? 0}</span>
          </p>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {attempt.shared_at ? (
            <>
              <p className="text-muted-foreground text-xs">{fmt(attempt.shared_at)}에 보냄</p>
              {attempt.share_note ? (
                <p className="rounded-md border border-dashed px-3 py-2 text-sm break-words whitespace-pre-wrap">{attempt.share_note}</p>
              ) : (
                <p className="text-muted-foreground text-sm">메모 없이 결과만 보냈어요.</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">학생이 선생님에게 보내지 않은 응시예요.</p>
          )}
        </div>
      </div>

      <ol className="divide-y rounded-md border">
        {(items ?? []).map((it) => {
          const r = byItem.get(it.id);
          const payload = (it.payload ?? {}) as Record<string, unknown>;
          const answer = (it.answer ?? {}) as Record<string, unknown>;
          return (
            <li key={it.id} className={r?.first === false ? "bg-destructive/5 px-4 py-3" : "px-4 py-3"}>
              <div className="flex items-start gap-3">
                <span className="bg-muted mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{it.position}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm break-words">{it.prompt}</p>
                  <p className="text-muted-foreground text-xs">
                    정답: {answerText(kind, payload, answer)}
                    {r?.firstMs != null && ` · ${(r.firstMs / 1000).toFixed(1)}초`}
                  </p>
                  {it.explanation && <p className="text-muted-foreground text-xs break-words">{it.explanation}</p>}
                </div>
                <div className="shrink-0">
                  {r?.first == null ? (
                    <Badge variant="outline">안 풂</Badge>
                  ) : r.first ? (
                    <Badge variant="success"><Check className="size-3" />맞음</Badge>
                  ) : (
                    <Badge variant="warning"><X className="size-3" />틀림{r.retries > 0 ? ` · ${r.retries}번 더 풀어 맞힘` : ""}</Badge>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
