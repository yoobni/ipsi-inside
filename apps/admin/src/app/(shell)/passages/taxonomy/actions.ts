"use server";

import { revalidatePath } from "next/cache";
import {
  conceptInputSchema,
  examSourceInputSchema,
  questionTypeInputSchema,
  workInputSchema,
  type ConceptInput,
  type ExamSourceInput,
  type QuestionTypeInput,
  type WorkInput,
} from "@ipsi/types";
import { friendlyDbError } from "@ipsi/lib";
import { ensureStaff } from "@/lib/auth";

type Result = { ok: true; id?: string } | { ok: false; message: string };

/**
 * 문항 태그 사전 4종(유형·작품·출처·개념) CRUD. 전부 세션 클라이언트 — RLS가
 * 'passages' 권한으로 막는다. 삭제는 없고 보관(archived)만: 문항이 이미 FK로 물고 있다.
 */
async function guard() {
  const check = await ensureStaff({ permission: "passages" });
  if ("error" in check) return check;
  return check;
}

function revalidate() {
  revalidatePath("/passages/taxonomy");
  revalidatePath("/passages");
}

// ── 유형 ──────────────────────────────────────────────────────────────────────
export async function upsertQuestionTypeAction(id: string | null, input: QuestionTypeInput): Promise<Result> {
  const check = await guard();
  if ("error" in check) return check.error;
  const parsed = questionTypeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const { supabase } = check;
  if (id) {
    const { error } = await supabase.from("question_types").update(parsed.data).eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    revalidate();
    return { ok: true, id };
  }
  const { count } = await supabase
    .from("question_types")
    .select("id", { count: "exact", head: true })
    .eq("area", parsed.data.area);
  const { data, error } = await supabase
    .from("question_types")
    .insert({ ...parsed.data, position: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: friendlyDbError(error) };
  revalidate();
  return { ok: true, id: data.id };
}

export async function archiveQuestionTypeAction(id: string, archived: boolean): Promise<Result> {
  const check = await guard();
  if ("error" in check) return check.error;
  const { error } = await check.supabase.from("question_types").update({ archived }).eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidate();
  return { ok: true };
}

// ── 작품/제재 ─────────────────────────────────────────────────────────────────
export async function upsertWorkAction(id: string | null, input: WorkInput): Promise<Result> {
  const check = await guard();
  if ("error" in check) return check.error;
  const parsed = workInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const row = {
    title: parsed.data.title,
    author: parsed.data.author || null,
    genre: parsed.data.genre || null,
    era: parsed.data.era || null,
  };
  const { supabase } = check;
  if (id) {
    const { error } = await supabase.from("works").update(row).eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    revalidate();
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("works").insert(row).select("id").single();
  if (error || !data) return { ok: false, message: friendlyDbError(error) };
  revalidate();
  return { ok: true, id: data.id };
}

export async function archiveWorkAction(id: string, archived: boolean): Promise<Result> {
  const check = await guard();
  if ("error" in check) return check.error;
  const { error } = await check.supabase.from("works").update({ archived }).eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidate();
  return { ok: true };
}

// ── 기출 출처 ─────────────────────────────────────────────────────────────────
export async function upsertExamSourceAction(id: string | null, input: ExamSourceInput): Promise<Result> {
  const check = await guard();
  if ("error" in check) return check.error;
  const parsed = examSourceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const row = {
    label: parsed.data.label,
    year: parsed.data.year ?? null,
    month: parsed.data.month ?? null,
    exam_kind: parsed.data.examKind ?? null,
    grade: parsed.data.grade ?? null,
  };
  const { supabase } = check;
  if (id) {
    const { error } = await supabase.from("exam_sources").update(row).eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    revalidate();
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("exam_sources").insert(row).select("id").single();
  if (error || !data) return { ok: false, message: friendlyDbError(error) };
  revalidate();
  return { ok: true, id: data.id };
}

export async function archiveExamSourceAction(id: string, archived: boolean): Promise<Result> {
  const check = await guard();
  if ("error" in check) return check.error;
  const { error } = await check.supabase.from("exam_sources").update({ archived }).eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidate();
  return { ok: true };
}

// ── 개념 ──────────────────────────────────────────────────────────────────────
export async function upsertConceptAction(id: string | null, input: ConceptInput): Promise<Result> {
  const check = await guard();
  if ("error" in check) return check.error;
  const parsed = conceptInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const row = {
    title: parsed.data.title,
    area: parsed.data.area ?? null,
    parent_id: parsed.data.parentId ?? null,
  };
  const { supabase } = check;
  if (id) {
    if (row.parent_id === id) return { ok: false, message: "자기 자신을 상위 개념으로 둘 수 없어요" };
    const { error } = await supabase.from("concepts").update(row).eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error) };
    revalidate();
    return { ok: true, id };
  }
  const { count } = await supabase.from("concepts").select("id", { count: "exact", head: true });
  const { data, error } = await supabase
    .from("concepts")
    .insert({ ...row, position: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: friendlyDbError(error) };
  revalidate();
  return { ok: true, id: data.id };
}

export async function archiveConceptAction(id: string, archived: boolean): Promise<Result> {
  const check = await guard();
  if ("error" in check) return check.error;
  const { error } = await check.supabase.from("concepts").update({ archived }).eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidate();
  return { ok: true };
}
