import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { guidePassageSchema, guideStepPayloadSchema, type GuidePassage, type GuideStepPayload } from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import { GuideRunner, type RunnerStep } from "./guide-runner";

export const dynamic = "force-dynamic";

/**
 * 가이드 단계 흐름. 지문 본문은 guide_passage() RPC(발행된 가이드의 read 단계만).
 * 진도는 guide_progress. 학부모는 보기만(완료 버튼 없음).
 */
export default async function GuidePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const { step: stepParam } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind !== "ok" || state.status !== "approved") redirect("/pending");

  const [{ data: guide }, { data: steps }, { data: progress }] = await Promise.all([
    supabase.from("guides").select("id, title, summary, work_id, works(title, author)").eq("id", id).maybeSingle(),
    supabase.from("guide_steps").select("id, position, kind, title, payload").eq("guide_id", id).order("position"),
    state.role === "student"
      ? supabase.from("guide_progress").select("step_id").eq("guide_id", id).eq("student_id", state.userId)
      : Promise.resolve({ data: [] as { step_id: string }[] }),
  ]);
  if (!guide || !steps || steps.length === 0) notFound();

  const parsedSteps = steps.flatMap((s) => {
    const p = guideStepPayloadSchema.safeParse({ kind: s.kind, ...(s.payload as Record<string, unknown>) });
    return p.success ? [{ id: s.id, title: s.title, payload: p.data }] : [];
  });
  if (parsedSteps.length === 0) notFound();

  // read 단계 지문 본문(발행 가이드 한정 RPC) + ox 단계 훈련 발행 여부
  const readIds = parsedSteps.flatMap((s) => (s.payload.kind === "read" ? [s.payload.passage_id] : []));
  const drillIds = parsedSteps.flatMap((s) => (s.payload.kind === "ox" ? [s.payload.drill_id] : []));
  const [passages, { data: drills }] = await Promise.all([
    Promise.all(
      readIds.map(async (pid) => {
        const { data } = await supabase.rpc("guide_passage", { p_guide_id: id, p_passage_id: pid });
        const parsed = data == null ? null : guidePassageSchema.safeParse(data);
        return [pid, parsed?.success ? parsed.data : null] as const;
      }),
    ),
    drillIds.length > 0 ? supabase.from("drills").select("id, title, kind").in("id", drillIds) : Promise.resolve({ data: [] as { id: string; title: string; kind: string }[] }),
  ]);
  const passageOf = new Map<string, GuidePassage | null>(passages);
  const drillOf = new Map((drills ?? []).map((d) => [d.id, d] as const));

  const runnerSteps: RunnerStep[] = parsedSteps.map((s) => {
    const payload: GuideStepPayload = s.payload;
    return {
      id: s.id,
      title: s.title,
      payload,
      passage: payload.kind === "read" ? (passageOf.get(payload.passage_id) ?? null) : null,
      drill: payload.kind === "ox" ? (drillOf.get(payload.drill_id) ?? null) : null,
    };
  });

  const w = Array.isArray(guide.works) ? guide.works[0] : guide.works;
  const initialIdx = Math.max(0, Math.min(parsedSteps.length - 1, Number(stepParam ?? 0) || 0));

  return (
    <GuideRunner
      guideId={id}
      title={guide.title}
      summary={guide.summary}
      workId={guide.work_id}
      workTitle={(w as { title: string } | null)?.title ?? null}
      steps={runnerSteps}
      completed={(progress ?? []).map((p) => p.step_id)}
      canComplete={state.role === "student"}
      initialIdx={initialIdx}
    />
  );
}
