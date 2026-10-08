import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ipsi/db";
import { sanitizeRichHtml } from "@ipsi/lib";
import type { QuestionInput, TaxonomyLists } from "@ipsi/types";

type Db = SupabaseClient<Database>;

/**
 * 문항 부가 정보(해설·개념 연결) 저장. 문항 insert 뒤 position 으로 id를 맞춘다.
 * 해설은 questions 컬럼이 아니라 question_explanations(제출한 학생만 읽는 RLS).
 * 등록 폼과 CSV 가져오기가 같이 쓴다.
 */
export async function saveQuestionExtras(
  supabase: Db,
  inserted: { id: string; position_in_passage: number }[],
  questions: QuestionInput[],
  adminId: string,
): Promise<string | null> {
  const idByPos = new Map(inserted.map((r) => [r.position_in_passage, r.id] as const));

  const explanations = questions.flatMap((q) => {
    const id = idByPos.get(q.position_in_passage);
    const body = q.explanation?.trim();
    return id && body ? [{ question_id: id, body: sanitizeRichHtml(body), updated_by: adminId }] : [];
  });
  if (explanations.length > 0) {
    const { error } = await supabase
      .from("question_explanations")
      .upsert(explanations, { onConflict: "question_id" });
    if (error) return `해설 저장 실패: ${error.message}`;
  }

  const links = questions.flatMap((q) => {
    const id = idByPos.get(q.position_in_passage);
    return id ? [...new Set(q.concept_ids ?? [])].map((concept_id) => ({ question_id: id, concept_id })) : [];
  });
  if (links.length > 0) {
    const { error } = await supabase
      .from("question_concepts")
      .upsert(links, { onConflict: "question_id,concept_id", ignoreDuplicates: true });
    if (error) return `개념 연결 실패: ${error.message}`;
  }
  return null;
}

/** 지문/문항 폼·CSV가 참조할 사전 목록(보관 제외) */
export async function loadTaxonomyLists(supabase: Db): Promise<TaxonomyLists> {
  const [{ data: types }, { data: works }, { data: sources }, { data: concepts }] = await Promise.all([
    supabase.from("question_types").select("id, area, label").eq("archived", false).order("area").order("position"),
    supabase.from("works").select("id, title, author").eq("archived", false).order("title"),
    supabase
      .from("exam_sources")
      .select("id, label")
      .eq("archived", false)
      .order("year", { ascending: false, nullsFirst: false })
      .order("month", { ascending: false, nullsFirst: false }),
    supabase.from("concepts").select("id, title, area").eq("archived", false).order("position"),
  ]);
  return {
    types: types ?? [],
    works: works ?? [],
    sources: sources ?? [],
    concepts: (concepts ?? []).map((c) => ({ ...c, area: c.area ?? null })),
  };
}
