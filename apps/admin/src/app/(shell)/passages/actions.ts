"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError, sanitizeRichHtml } from "@ipsi/lib";
import { ensureStaff } from "@/lib/auth";
import { passageWithQuestionsSchema, type QuestionChoice } from "@ipsi/types";
import { saveQuestionExtras } from "./question-extras";

type Result = { ok: true; id: string } | { ok: false; message: string };

export async function createPassageWithQuestionsAction(
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const payloadRaw = fd.get("payload");
  if (typeof payloadRaw !== "string") {
    return { ok: false, message: "payload 누락" };
  }

  let parsed;
  try {
    parsed = passageWithQuestionsSchema.parse(JSON.parse(payloadRaw));
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "입력 검증 실패",
    };
  }

  const check = await ensureStaff({ permission: "passages" });
  if ("error" in check) return check.error;
  const { supabase } = check;

  const { data: passage, error: pErr } = await supabase
    .from("passages")
    .insert({
      title: parsed.passage.title,
      source_type: parsed.passage.source_type,
      content: sanitizeRichHtml(parsed.passage.content),
      unit_major: parsed.passage.unit_major,
      unit_minor: parsed.passage.unit_minor ?? null,
      work_id: parsed.passage.work_id ?? null,
      source_id: parsed.passage.source_id ?? null,
      created_by: check.adminId,
    })
    .select("id")
    .single();

  if (pErr || !passage) {
    return {
      ok: false,
      message: `지문 저장 실패: ${pErr?.message ?? "알 수 없음"}`,
    };
  }

  const rows = parsed.questions.map((q) => ({
    passage_id: passage.id,
    position_in_passage: q.position_in_passage,
    stem: sanitizeRichHtml(q.stem),
    supplementary: q.supplementary ? sanitizeRichHtml(q.supplementary) : null,
    choices: sanitizeChoices(q.choices),
    correct_answer: q.correct_answer,
    points: q.points,
    difficulty: q.difficulty ?? null,
    unit_minor: q.unit_minor ?? null,
    type_id: q.type_id ?? null,
  }));

  const { data: insertedQs, error: qErr } = await supabase
    .from("questions")
    .insert(rows)
    .select("id, position_in_passage");
  if (qErr || !insertedQs) {
    // rollback 지문 (best-effort)
    await supabase.from("passages").delete().eq("id", passage.id);
    return { ok: false, message: `문항 저장 실패: ${qErr?.message ?? "알 수 없음"}` };
  }
  const extrasErr = await saveQuestionExtras(supabase, insertedQs, parsed.questions, check.adminId);
  if (extrasErr) return { ok: false, message: extrasErr };

  revalidatePath("/passages");
  return { ok: true, id: passage.id };
}

export async function updatePassageWithQuestionsAction(
  passageId: string,
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const payloadRaw = fd.get("payload");
  if (typeof payloadRaw !== "string")
    return { ok: false, message: "payload 누락" };

  let parsed;
  try {
    parsed = passageWithQuestionsSchema.parse(JSON.parse(payloadRaw));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "검증 실패" };
  }

  const check = await ensureStaff({ permission: "passages" });
  if ("error" in check) return check.error;
  const { supabase } = check;

  // 시험지에 사용 중이고 학생이 응시 시작한 적 있는지 확인
  const { data: existingQs } = await supabase
    .from("questions")
    .select("id")
    .eq("passage_id", passageId);
  const existingIds = (existingQs ?? []).map((q) => q.id);

  if (existingIds.length > 0) {
    const { data: tsq } = await supabase
      .from("test_sheet_questions")
      .select("test_sheet_id")
      .in("question_id", existingIds);
    const sheetIds = Array.from(new Set((tsq ?? []).map((t) => t.test_sheet_id)));

    if (sheetIds.length > 0) {
      const { data: asg } = await supabase
        .from("test_assignments")
        .select("id")
        .in("test_sheet_id", sheetIds);
      const asgIds = (asg ?? []).map((a) => a.id);
      if (asgIds.length > 0) {
        const { count } = await supabase
          .from("test_attempts")
          .select("id", { count: "exact", head: true })
          .in("assignment_id", asgIds);
        if ((count ?? 0) > 0) {
          return {
            ok: false,
            message:
              "이미 학생이 응시한 시험지에 포함된 문항이라 수정할 수 없어요.",
          };
        }
      }
    }
  }

  // 지문 갱신
  const { error: pErr } = await supabase
    .from("passages")
    .update({
      title: parsed.passage.title,
      source_type: parsed.passage.source_type,
      content: sanitizeRichHtml(parsed.passage.content),
      unit_major: parsed.passage.unit_major,
      unit_minor: parsed.passage.unit_minor ?? null,
      work_id: parsed.passage.work_id ?? null,
      source_id: parsed.passage.source_id ?? null,
    })
    .eq("id", passageId);
  if (pErr) return { ok: false, message: `지문 수정 실패: ${pErr.message}` };

  // 문항 전체 교체 (시험지 매핑은 question_id ON DELETE RESTRICT라 사용 중이면 막힘 → 위에서 이미 차단)
  await supabase.from("questions").delete().eq("passage_id", passageId);

  const rows = parsed.questions.map((q) => ({
    passage_id: passageId,
    position_in_passage: q.position_in_passage,
    stem: sanitizeRichHtml(q.stem),
    supplementary: q.supplementary ? sanitizeRichHtml(q.supplementary) : null,
    choices: sanitizeChoices(q.choices),
    correct_answer: q.correct_answer,
    points: q.points,
    difficulty: q.difficulty ?? null,
    unit_minor: q.unit_minor ?? null,
    type_id: q.type_id ?? null,
  }));
  const { data: insertedQs, error: qErr } = await supabase
    .from("questions")
    .insert(rows)
    .select("id, position_in_passage");
  if (qErr || !insertedQs) return { ok: false, message: `문항 저장 실패: ${qErr?.message ?? "알 수 없음"}` };
  // 해설·개념은 문항 삭제 시 cascade로 같이 지워졌으니 새로 넣는다
  const extrasErr = await saveQuestionExtras(supabase, insertedQs, parsed.questions, check.adminId);
  if (extrasErr) return { ok: false, message: extrasErr };

  revalidatePath("/passages");
  revalidatePath(`/passages/${passageId}`);
  return { ok: true, id: passageId };
}

export async function deletePassageAction(passageId: string): Promise<Result> {
  const check = await ensureStaff({ permission: "passages" });
  if ("error" in check) return check.error;
  const { supabase } = check;

  // 시험지에 들어가 있는지 확인
  const { count } = await supabase
    .from("test_sheet_questions")
    .select("id", { count: "exact", head: true })
    .in(
      "question_id",
      // subquery 안 되니 직접 조회
      (
        await supabase.from("questions").select("id").eq("passage_id", passageId)
      ).data?.map((q) => q.id) ?? [],
    );

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: "시험지에 사용 중인 문항이 있어 삭제할 수 없어요.",
    };
  }

  const { error } = await supabase.from("passages").delete().eq("id", passageId);
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/passages");
  return { ok: true, id: passageId };
}

/** 선지도 화면에서 HTML로 그려진다(`c.text`). 지문·발문과 같은 기준으로 거른다. */
function sanitizeChoices(choices: QuestionChoice[]): QuestionChoice[] {
  return choices.map((c) => ({ ...c, text: sanitizeRichHtml(c.text) }));
}
