"use server";

import { redirect } from "next/navigation";
import { createPracticeInputSchema, type CreatePracticeInput } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Fail = { ok: false; message: string };

/**
 * 보충 세트 만들기 — create_practice_set RPC(본인·하루 2세트·3문항↑ 가드는 SQL 안).
 * 성공하면 시험 상세로 보낸다(기존 응시 흐름).
 */
export async function createPracticeSetAction(input: CreatePracticeInput): Promise<Fail | never> {
  const parsed = createPracticeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_practice_set", {
    p_tag_kind: parsed.data.tagKind,
    p_tag_id: parsed.data.tagId,
    p_size: parsed.data.size,
    p_for_student: null,
  });
  if (error || !data) {
    const msg = error?.message ?? "";
    if (msg.includes("daily limit")) return { ok: false, message: "보충 세트는 하루 2개까지 만들 수 있어요. 내일 다시 해봐요." };
    if (msg.includes("not enough questions")) {
      return { ok: false, message: "이 태그로 낼 수 있는 새 문제가 아직 부족해요. 선생님이 문항을 더 등록하면 열려요." };
    }
    return { ok: false, message: "보충 세트를 만들지 못했어요. 잠시 후 다시 시도해주세요." };
  }
  redirect(`/dashboard/tests/${data}`);
}
