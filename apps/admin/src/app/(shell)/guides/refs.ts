import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ipsi/db";
import type { GuideEditorRefs } from "./guide-editor";

/** 가이드 편집기가 참조하는 작품·지문·훈련 목록 */
export async function loadGuideRefs(supabase: SupabaseClient<Database>): Promise<GuideEditorRefs> {
  const [{ data: works }, { data: passages }, { data: drills }] = await Promise.all([
    supabase.from("works").select("id, title, author").eq("archived", false).order("title"),
    supabase.from("passages").select("id, title, work_id, source_type").order("created_at", { ascending: false }).limit(500),
    supabase.from("drills").select("id, title, kind, work_id, is_published").order("created_at", { ascending: false }),
  ]);
  return {
    works: works ?? [],
    passages: (passages ?? []).map((p) => ({ ...p, source_type: String(p.source_type) })),
    drills: drills ?? [],
  };
}
