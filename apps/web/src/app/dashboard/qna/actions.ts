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

  // imagePath는 클라가 보내는 값이라 믿으면 안 된다. 업로드 RLS는 '쓰기'만
  // 본인 폴더로 막을 뿐, 여기 저장되는 경로는 검증되지 않는다. 남의 폴더
  // 경로(`{남의uid}/..`)를 넣으면 어드민 상세가 service-role signed URL로
  // 그 이미지를 열어버린다. 반드시 본인 uid 폴더로 시작해야 한다.
  if (parsed.data.imagePath && !parsed.data.imagePath.startsWith(`${user.id}/`)) {
    return { ok: false, message: "첨부 경로가 올바르지 않아요. 사진을 다시 첨부해주세요." };
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

/** 답변 전(open)인 본인 질문 삭제. 첨부 사진도 스토리지에서 함께 지운다. */
export async function deleteQuestionAction(id: string): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요해요" };

  // 지우기 전에 첨부 경로 확보 (행이 사라지면 고아 파일이 남는다)
  const { data: q } = await supabase
    .from("qna_questions")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("qna_questions").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };

  // 본인 폴더의 파일만 정리 (경로는 저장 시 이미 검증됨)
  if (q?.image_path && q.image_path.startsWith(`${user.id}/`)) {
    await supabase.storage.from("qna-images").remove([q.image_path]);
  }

  revalidatePath("/dashboard/qna");
  return { ok: true };
}
