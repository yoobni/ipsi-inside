"use server";

import { revalidatePath } from "next/cache";
import { guideSaveSchema, type GuideSaveInput } from "@ipsi/types";
import { friendlyDbError, sanitizeRichHtml } from "@ipsi/lib";
import { ensureStaff } from "@/lib/auth";

type Result = { ok: true; id: string } | { ok: false; message: string };

const MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

/** 가이드 이미지(개념도·만화) 업로드 — guide-assets(공개 읽기). 'passages' 권한. */
export async function uploadGuideImageAction(fd: FormData): Promise<{ ok: true; url: string; path: string } | { ok: false; message: string }> {
  const check = await ensureStaff({ permission: "passages" });
  if ("error" in check) return check.error;
  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, message: "파일이 없습니다." };
  if (file.size > MAX_BYTES) return { ok: false, message: "5MB 이하의 이미지만 업로드 가능합니다." };
  const ext = EXT_BY_MIME[file.type];
  if (!ext) return { ok: false, message: "지원 형식: PNG / JPEG / GIF / WebP" };
  // 확장자는 검증한 MIME 에서 — 파일명은 사용자가 정하는 값
  const path = `guides/${check.adminId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await check.supabase.storage.from("guide-assets").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  const { data: pub } = check.supabase.storage.from("guide-assets").getPublicUrl(path);
  if (!pub?.publicUrl) return { ok: false, message: "공개 URL 생성 실패" };
  return { ok: true, url: pub.publicUrl, path };
}

/**
 * 가이드 저장 — 단계는 id 기준 diff(갱신/추가/삭제). 글(html)은 저장 시점에 sanitize.
 * 세션 클라이언트 — RLS 'passages'.
 */
export async function saveGuideAction(id: string | null, input: GuideSaveInput): Promise<Result> {
  const check = await ensureStaff({ permission: "passages" });
  if ("error" in check) return check.error;
  const parsed = guideSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const g = parsed.data;
  const { supabase, adminId } = check;

  const meta = { title: g.title, summary: g.summary || null, work_id: g.workId ?? null };
  let guideId = id;
  if (guideId) {
    const { error } = await supabase.from("guides").update(meta).eq("id", guideId);
    if (error) return { ok: false, message: friendlyDbError(error) };
  } else {
    const { data, error } = await supabase.from("guides").insert({ ...meta, created_by: adminId }).select("id").single();
    if (error || !data) return { ok: false, message: friendlyDbError(error) };
    guideId = data.id;
  }

  const rows = g.steps.map((s, i) => {
    const p = s.payload;
    const payload =
      p.kind === "intro" || p.kind === "summary" || p.kind === "review"
        ? { html: sanitizeRichHtml(p.html) }
        : p.kind === "read"
          ? { passage_id: p.passage_id, note: p.note || null }
          : p.kind === "visual" || p.kind === "comic"
            ? { images: p.images.map((im) => ({ url: im.url, path: im.path, caption: im.caption || null })), html: p.html ? sanitizeRichHtml(p.html) : null }
            : p.kind === "ox"
              ? { drill_id: p.drill_id }
              : { size: p.size, note: p.note || null };
    return { id: s.id ?? undefined, guide_id: guideId!, position: i + 1, kind: p.kind, title: s.title, payload };
  });
  const keep = rows.map((r) => r.id).filter((x): x is string => !!x);
  {
    let q = supabase.from("guide_steps").delete().eq("guide_id", guideId);
    if (keep.length > 0) q = q.not("id", "in", `(${keep.join(",")})`);
    const { error } = await q;
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  for (const r of rows.filter((r) => r.id)) {
    const { error } = await supabase
      .from("guide_steps")
      .update({ position: r.position, kind: r.kind, title: r.title, payload: r.payload })
      .eq("id", r.id!)
      .eq("guide_id", guideId); // 다른 가이드의 단계 id 를 끼워 넣어도 건드리지 않게
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  const inserts = rows
    .filter((r) => !r.id)
    .map((r) => ({ guide_id: r.guide_id, position: r.position, kind: r.kind, title: r.title, payload: r.payload }));
  if (inserts.length > 0) {
    const { error } = await supabase.from("guide_steps").insert(inserts);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  revalidatePath("/guides");
  revalidatePath(`/guides/${guideId}`);
  return { ok: true, id: guideId };
}

export async function toggleGuidePublishAction(id: string, publish: boolean): Promise<Result> {
  const check = await ensureStaff({ permission: "passages" });
  if ("error" in check) return check.error;
  if (publish) {
    const { count } = await check.supabase.from("guide_steps").select("id", { count: "exact", head: true }).eq("guide_id", id);
    if ((count ?? 0) === 0) return { ok: false, message: "단계가 없는 가이드는 발행할 수 없어요" };
  }
  const { error } = await check.supabase
    .from("guides")
    .update({ status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/guides");
  revalidatePath(`/guides/${id}`);
  return { ok: true, id };
}

export async function deleteGuideAction(id: string): Promise<Result> {
  const check = await ensureStaff({ permission: "passages" });
  if ("error" in check) return check.error;
  const { error } = await check.supabase.from("guides").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/guides");
  return { ok: true, id };
}
