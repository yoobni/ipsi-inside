"use server";

import { revalidatePath } from "next/cache";
import { columnInputSchema } from "@ipsi/types";
import { friendlyDbError, sanitizeRichHtml } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result = { ok: true; id?: string } | { ok: false; message: string };

type AdminOk = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
};
type AdminErr = { error: { ok: false; message: string } };

/**
 * 관리자 확인 — RLS(columns admin-only)만 믿지 않고 앱단에서도 막는다.
 * Q&A 액션(ensureAdmin)과 같은 기준의 방어심층화.
 */
async function ensureAdmin(): Promise<AdminOk | AdminErr> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: { ok: false, message: "인증 필요" } };
  const { data: p } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (p?.role !== "admin" || p?.status !== "approved") {
    return { error: { ok: false, message: "권한이 없어요" } };
  }
  return { supabase, userId: user.id };
}

/** 칼럼 작성/편집. 본문 HTML은 저장 시점에 sanitize (자료·지문과 같은 기준). */
export async function upsertColumnAction(
  id: string | null,
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;
  const { supabase, userId: user_id } = check;

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
    .insert({ title: parsed.data.title, body, created_by: user_id })
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
  const check = await ensureAdmin();
  if ("error" in check) return check.error;
  const { supabase } = check;

  const { data: col } = await supabase
    .from("columns")
    .select("title, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!col) return { ok: false, message: "칼럼을 찾을 수 없어요." };
  // 한 번이라도 발행된 적 있으면(재발행) 알림을 다시 쏘지 않는다 — 오타 수정
  // 후 재발행할 때마다 전체 학생·학부모에게 중복 알림이 가는 걸 막는다.
  const alreadyNotified = col.published_at !== null;

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

  if (publish && effectiveAt && !alreadyNotified) {
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
  const check = await ensureAdmin();
  if ("error" in check) return check.error;
  const { error } = await check.supabase.from("columns").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/columns");
  return { ok: true };
}
