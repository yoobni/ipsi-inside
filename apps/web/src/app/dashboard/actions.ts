"use server";

import { revalidatePath } from "next/cache";
import { journalSubmitSchema } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { todayKst } from "@/lib/kst";

type Result = { ok: true } | { ok: false; message: string };

/** 오늘 일지 제출/수정 (학생만) */
export async function submitJournalAction(
  _prev: Result | null,
  formData: FormData,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (
    profile?.role !== "student" ||
    profile?.status !== "approved"
  ) {
    return { ok: false, message: "학생만 작성할 수 있어요" };
  }

  const parsed = journalSubmitSchema.safeParse({
    class_question: formData.get("class_question") ?? null,
    test_question: formData.get("test_question") ?? null,
    message_to_teacher: formData.get("message_to_teacher") ?? null,
    learning_log: formData.get("learning_log") ?? null,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "입력 오류" };
  }

  const norm = (s: string | null | undefined) => {
    const t = (s ?? "").trim();
    return t.length > 0 ? t : null;
  };

  const today = todayKst();

  const { error } = await supabase
    .from("study_journals")
    .upsert(
      {
        student_id: user.id,
        journal_date: today,
        // content는 deprecated — 4갈래만 채움
        class_question: norm(parsed.data.class_question),
        test_question: norm(parsed.data.test_question),
        message_to_teacher: norm(parsed.data.message_to_teacher),
        learning_log: norm(parsed.data.learning_log),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,journal_date" },
    );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/journal");
  return { ok: true };
}
