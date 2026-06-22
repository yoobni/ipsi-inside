"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@ipsi/lib";
import { z } from "zod";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result = { ok: true; id?: string } | { ok: false; message: string };

const inputSchema = z.object({
  title: z.string().trim().min(2, "제목을 입력해주세요").max(120),
  body: z.string().trim().max(2000).nullable().optional(),
  audience: z.enum(["all", "student", "parent"]),
  expires_at: z.string().nullable().optional(),
});

export async function upsertAnnouncementAction(
  id: string | null,
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const parsed = inputSchema.safeParse({
    title: fd.get("title"),
    body: fd.get("body"),
    audience: fd.get("audience"),
    expires_at: fd.get("expires_at") || null,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  }

  if (id) {
    const { error } = await supabase
      .from("announcements")
      .update({
        title: parsed.data.title,
        body: parsed.data.body ?? null,
        audience: parsed.data.audience,
        expires_at: parsed.data.expires_at ?? null,
      })
      .eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    revalidatePath("/announcements");
    return { ok: true, id };
  } else {
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title: parsed.data.title,
        body: parsed.data.body ?? null,
        audience: parsed.data.audience,
        expires_at: parsed.data.expires_at ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: error?.message ?? "" };
    revalidatePath("/announcements");
    return { ok: true, id: data.id };
  }
}

export async function togglePublishAction(
  id: string,
  publish: boolean,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const { data: ann } = await supabase
    .from("announcements")
    .select("title, body, audience")
    .eq("id", id)
    .maybeSingle();
  if (!ann) return { ok: false, message: "공지를 찾을 수 없어요." };

  const { error } = await supabase
    .from("announcements")
    .update({
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };

  // 발행 시 알림 푸시 (audience에 맞춰)
  if (publish) {
    let userQuery = supabase
      .from("profiles")
      .select("id")
      .eq("status", "approved");
    if (ann.audience === "student") userQuery = userQuery.eq("role", "student");
    else if (ann.audience === "parent")
      userQuery = userQuery.eq("role", "parent");
    else userQuery = userQuery.in("role", ["student", "parent"]);

    const { data: users } = await userQuery;
    const notifs = (users ?? []).map((u) => ({
      user_id: u.id,
      type: "announcement",
      title: `공지: ${ann.title}`,
      body: ann.body,
      link: "/dashboard",
    }));
    if (notifs.length > 0) {
      await supabase.from("notifications").insert(notifs);
    }
  }

  revalidatePath("/announcements");
  return { ok: true, id };
}

export async function deleteAnnouncementAction(id: string): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/announcements");
  return { ok: true };
}
