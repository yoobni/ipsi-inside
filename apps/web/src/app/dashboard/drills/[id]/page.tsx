import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { drillPlaySchema } from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import { DrillPlayer } from "./drill-player";

export const dynamic = "force-dynamic";

/** 훈련 풀이 — 항목은 drill_play()(정답 없음), 채점은 서버 액션→RPC. 학생만 풀 수 있다. */
export default async function DrillPlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind !== "ok" || state.status !== "approved") redirect("/pending");
  if (state.role !== "student") redirect("/dashboard/drills");

  const { data } = await supabase.rpc("drill_play", { p_drill_id: id });
  const parsed = data == null ? null : drillPlaySchema.safeParse(data);
  if (!parsed || !parsed.success) notFound();
  if (parsed.data.items.length === 0) notFound();

  return <DrillPlayer play={parsed.data} />;
}
