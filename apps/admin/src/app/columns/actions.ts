"use server";

import { revalidatePath } from "next/cache";
import { columnInputSchema } from "@ipsi/types";
import { friendlyDbError, sanitizeRichHtml } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result = { ok: true; id?: string } | { ok: false; message: string };

/** 칼럼 작성/편집. 본문 HTML은 저장 시점에 sanitize (자료·지문과 같은 기준). */
export async function upsertColumnAction(
  id: string | null,
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const parsed = columnInputSchema.safeParse({
    title: fd.get("title"),
    body: fd.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  }
  const body = sanitizeRichHtml(parsed.data.body);

  if (id) {
    const { error } = await supabase
      .from("columns")
      .update({ title: parsed.data.title, body })
      .eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    revalidatePath("/columns");
    revalidatePath(`/columns/${id}`);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("columns")
    .insert({ title: parsed.data.title, body, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/columns");
  return { ok: true, id: data.id };
}

/**
 * 발행/발행취소. 발행 시 승인 학생·학부모에게 알림 fan-out.
 * publishAtIso로 예약 발행 가능(공지·자료와 같은 패턴 — 알림 created_at이 미래면 종에 안 뜸).
 */
export async function toggleColumnPublishAction(
  id: string,
  publish: boolean,
  publishAtIso?: string | null,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const { data: col } = await supabase
    .from("columns")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  if (!col) return { ok: false, message: "칼럼을 찾을 수 없어요." };

  const effectiveAt = publish
    ? publishAtIso && publishAtIso.length > 0
      ? new Date(publishAtIso).toISOString()
      : new Date().toISOString()
    : null;

  const { error } = await supabase
    .from("columns")
    .update({ is_published: publish, published_at: effectiveAt })
    .eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };

  if (publish && effectiveAt) {
    const { data: users } = await supabase
      .from("profiles")
      .select("id")
      .eq("status", "approved")
      .in("role", ["student", "parent"]);
    const notifs = (users ?? []).map((u) => ({
      user_id: u.id,
      type: "column_published",
      title: `새 칼럼: ${col.title}`,
      body: null,
      link: `/dashboard/columns/${id}`,
      created_at: effectiveAt,
    }));
    if (notifs.length > 0) {
      await supabase.from("notifications").insert(notifs);
    }
  }

  revalidatePath("/columns");
  revalidatePath(`/columns/${id}`);
  return { ok: true, id };
}

export async function deleteColumnAction(id: string): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };
  const { error } = await supabase.from("columns").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/columns");
  return { ok: true };
}
