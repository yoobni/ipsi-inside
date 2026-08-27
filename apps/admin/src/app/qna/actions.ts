"use server";

import { revalidatePath } from "next/cache";
import { qnaAnswerInputSchema, qnaCategoryInputSchema } from "@ipsi/types";
import { friendlyDbError, sanitizeRichHtml } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { generateAnswerDraft } from "@/lib/qna-ai";

type Result = { ok: true } | { ok: false; message: string };

type AdminOk = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
};
type AdminErr = { error: { ok: false; message: string } };

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

/**
 * 답변 저장/발행. published=true면 학생에게 노출 + 알림.
 * 답변 텍스트는 plain text로 다룬다(현재 UI가 textarea). 혹시 HTML이 섞여도
 * 저장 시 sanitize한다.
 */
export async function saveAnswerAction(
  _prev: Result | null,
  fd: FormData,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;
  const { supabase, userId } = check;

  const parsed = qnaAnswerInputSchema.safeParse({
    questionId: fd.get("questionId"),
    body: fd.get("body"),
    publish: fd.get("publish") === "on" || fd.get("publish") === "true",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  }

  const body = sanitizeRichHtml(parsed.data.body);
  const publishedAt = parsed.data.publish ? new Date().toISOString() : null;

  // upsert (질문당 1답변, question_id unique)
  const { error } = await supabase.from("qna_answers").upsert(
    {
      question_id: parsed.data.questionId,
      body,
      answered_by: userId,
      published_at: publishedAt,
    },
    { onConflict: "question_id" },
  );
  if (error) return { ok: false, message: friendlyDbError(error) };

  // 질문 상태 갱신 + (발행 시) 학생 알림
  if (parsed.data.publish) {
    const { data: q } = await supabase
      .from("qna_questions")
      .select("student_id")
      .eq("id", parsed.data.questionId)
      .maybeSingle();
    await supabase
      .from("qna_questions")
      .update({ status: "answered" })
      .eq("id", parsed.data.questionId);
    if (q?.student_id) {
      await supabase.from("notifications").insert({
        user_id: q.student_id,
        type: "qna_answered",
        title: "질문에 답변이 달렸어요",
        body: parsed.data.body.slice(0, 60),
        link: "/dashboard/qna",
      });
    }
  }

  revalidatePath("/qna");
  revalidatePath(`/qna/${parsed.data.questionId}`);
  return { ok: true };
}

/** AI 답변 초안 생성 — 지금은 어댑터가 미구현이라 안내만 돌려준다. */
export async function generateDraftAction(
  questionId: string,
): Promise<{ ok: true; draft: string } | { ok: false; message: string }> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;
  const { supabase } = check;

  const { data: q } = await supabase
    .from("qna_questions")
    .select("body, question_no, reference_label, category_id")
    .eq("id", questionId)
    .maybeSingle();
  if (!q) return { ok: false, message: "질문을 찾을 수 없어요." };

  let categoryLabel: string | null = null;
  if (q.category_id) {
    const { data: c } = await supabase
      .from("qna_categories")
      .select("label")
      .eq("id", q.category_id)
      .maybeSingle();
    categoryLabel = c?.label ?? null;
  }

  const res = await generateAnswerDraft({
    questionBody: q.body,
    categoryLabel,
    referenceLabel: q.reference_label,
    questionNo: q.question_no,
  });
  if (!res.ok) return res;

  // 생성 성공 시 ai_draft에 보관 (원장이 검수 후 body로 다듬어 발행)
  await supabase
    .from("qna_answers")
    .upsert(
      { question_id: questionId, ai_draft: res.draft, body: res.draft },
      { onConflict: "question_id" },
    );
  return { ok: true, draft: res.draft };
}

// ── 카테고리(가이드라인) 관리 ────────────────────────────────────────────────
export async function upsertCategoryAction(
  id: string | null,
  _prev: Result | null,
  fd: FormData,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;
  const { supabase } = check;

  const parsed = qnaCategoryInputSchema.safeParse({
    label: fd.get("label"),
    placeholder: (fd.get("placeholder") as string) || null,
    needsReference: fd.get("needsReference") === "on" || fd.get("needsReference") === "true",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  }

  if (id) {
    const { error } = await supabase
      .from("qna_categories")
      .update({
        label: parsed.data.label,
        placeholder: parsed.data.placeholder ?? null,
        needs_reference: parsed.data.needsReference,
      })
      .eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
  } else {
    const { count } = await supabase
      .from("qna_categories")
      .select("id", { count: "exact", head: true });
    const { error } = await supabase.from("qna_categories").insert({
      label: parsed.data.label,
      placeholder: parsed.data.placeholder ?? null,
      needs_reference: parsed.data.needsReference,
      position: count ?? 0,
    });
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  revalidatePath("/qna/settings");
  revalidatePath("/qna");
  return { ok: true };
}

/** 보관(soft delete) — 기존 질문의 category_id는 set null로 살아있다. */
export async function archiveCategoryAction(
  id: string,
  archived: boolean,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;
  const { error } = await check.supabase
    .from("qna_categories")
    .update({ archived })
    .eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/qna/settings");
  return { ok: true };
}
