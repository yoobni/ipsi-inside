"use server";

import { revalidatePath } from "next/cache";
import { qnaQuestionInputSchema } from "@ipsi/types";
import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";

type Result = { ok: true } | { ok: false; message: string };

/** 질문 작성. 저장 후 원장에게 알림. */
export async function createQuestionAction(
  _prev: Result | null,
  fd: FormData,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요해요" };

  const parsed = qnaQuestionInputSchema.safeParse({
    categoryId: fd.get("categoryId"),
    referenceLabel: (fd.get("referenceLabel") as string) || null,
    questionNo: (fd.get("questionNo") as string) || null,
    body: fd.get("body"),
    imagePath: (fd.get("imagePath") as string) || null,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  }

  const { data: q, error } = await supabase
    .from("qna_questions")
    .insert({
      student_id: user.id,
      category_id: parsed.data.categoryId,
      reference_label: parsed.data.referenceLabel ?? null,
      question_no: parsed.data.questionNo ?? null,
      body: parsed.data.body,
      image_path: parsed.data.imagePath ?? null,
    })
    .select("id")
    .single();
  if (error || !q) return { ok: false, message: friendlyDbError(error) };

  // 원장 알림 — 학생 세션은 admin 프로필을 못 읽으니 service_role로.
  const admin = createAdminSupabaseClient();
  const { data: me } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("status", "approved");
  const notifs = (admins ?? []).map((a) => ({
    user_id: a.id,
    type: "qna_asked",
    title: `${me?.full_name ?? "학생"} 질문`,
    body: parsed.data.body.slice(0, 60),
    link: `/qna/${q.id}`,
  }));
  if (notifs.length > 0) await admin.from("notifications").insert(notifs);

  revalidatePath("/dashboard/qna");
  return { ok: true };
}

/** 답변 전(open)인 본인 질문 삭제. */
export async function deleteQuestionAction(id: string): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("qna_questions").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/dashboard/qna");
  return { ok: true };
}
