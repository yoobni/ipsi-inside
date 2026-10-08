"use server";

import { revalidatePath } from "next/cache";
import { drillSaveSchema, type DrillSaveInput } from "@ipsi/types";
import { friendlyDbError } from "@ipsi/lib";
import { ensureStaff } from "@/lib/auth";

type Result = { ok: true; id: string } | { ok: false; message: string };

/**
 * 훈련 저장(신규/수정) — 항목은 id 기준 diff: 있으면 갱신, 없으면 추가, 빠지면 삭제.
 * 삭제된 항목의 결과(drill_item_results)는 cascade 로 같이 사라진다.
 * 세션 클라이언트 — RLS가 'passages' 권한으로 막는다.
 */
export async function saveDrillAction(id: string | null, input: DrillSaveInput): Promise<Result> {
  const check = await ensureStaff({ permission: "passages" });
  if ("error" in check) return check.error;
  const parsed = drillSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const d = parsed.data;
  const { supabase, adminId } = check;

  const meta = {
    title: d.title,
    description: d.description || null,
    kind: d.kind,
    area: d.area ?? null,
    work_id: d.workId ?? null,
    time_limit_sec: d.timeLimitSec ?? null,
  };

  let drillId = id;
  if (drillId) {
    const { error } = await supabase.from("drills").update(meta).eq("id", drillId);
    if (error) return { ok: false, message: friendlyDbError(error) };
  } else {
    const { data, error } = await supabase
      .from("drills")
      .insert({ ...meta, created_by: adminId })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: friendlyDbError(error) };
    drillId = data.id;
  }

  // 개념 연결 — 통째로 교체
  await supabase.from("drill_concepts").delete().eq("drill_id", drillId);
  if (d.conceptIds.length > 0) {
    const { error } = await supabase
      .from("drill_concepts")
      .insert([...new Set(d.conceptIds)].map((concept_id) => ({ drill_id: drillId!, concept_id })));
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  // 항목 diff
  const rows = d.items.map((x, i) => {
    const it = x.item;
    const payload =
      it.kind === "ox" ? {} : it.kind === "choice" ? { options: it.options } : { buckets: it.buckets, tokens: it.tokens };
    return {
      id: x.id ?? undefined,
      drill_id: drillId!,
      position: i + 1,
      prompt: it.prompt,
      payload,
      answer: it.answer,
      explanation: it.explanation || null,
    };
  });
  const keepIds = rows.map((r) => r.id).filter((x): x is string => !!x);
  {
    let q = supabase.from("drill_items").delete().eq("drill_id", drillId);
    if (keepIds.length > 0) q = q.not("id", "in", `(${keepIds.join(",")})`);
    const { error } = await q;
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  const updates = rows.filter((r) => r.id);
  const inserts = rows.filter((r) => !r.id).map(({ id: _id, ...r }) => r);
  for (const r of updates) {
    const { error } = await supabase
      .from("drill_items")
      .update({ position: r.position, prompt: r.prompt, payload: r.payload, answer: r.answer, explanation: r.explanation })
      .eq("id", r.id!);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from("drill_items").insert(inserts);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  revalidatePath("/drills");
  revalidatePath(`/drills/${drillId}`);
  return { ok: true, id: drillId };
}

export async function toggleDrillPublishAction(id: string, publish: boolean): Promise<Result> {
  const check = await ensureStaff({ permission: "passages" });
  if ("error" in check) return check.error;
  if (publish) {
    const { count } = await check.supabase.from("drill_items").select("id", { count: "exact", head: true }).eq("drill_id", id);
    if ((count ?? 0) === 0) return { ok: false, message: "항목이 없는 훈련은 발행할 수 없어요" };
  }
  const { error } = await check.supabase
    .from("drills")
    .update({ is_published: publish, published_at: publish ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/drills");
  revalidatePath(`/drills/${id}`);
  return { ok: true, id };
}

export async function deleteDrillAction(id: string): Promise<Result> {
  const check = await ensureStaff({ permission: "passages" });
  if ("error" in check) return check.error;
  const { error } = await check.supabase.from("drills").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/drills");
  return { ok: true, id };
}
