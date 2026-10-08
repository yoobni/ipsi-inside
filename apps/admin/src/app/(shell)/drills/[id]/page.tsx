import { notFound } from "next/navigation";
import { drillItemInputSchema, type DrillKind, type PassageSource } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { loadTaxonomyLists } from "../../passages/question-extras";
import { DrillEditor, type EditorItem } from "../drill-editor";

export const dynamic = "force-dynamic";

export default async function EditDrillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [{ data: drill }, { data: items }, { data: concepts }, taxonomy] = await Promise.all([
    supabase.from("drills").select("id, title, description, kind, area, work_id, time_limit_sec, is_published").eq("id", id).maybeSingle(),
    supabase.from("drill_items").select("id, position, prompt, payload, answer, explanation").eq("drill_id", id).order("position"),
    supabase.from("drill_concepts").select("concept_id").eq("drill_id", id),
    loadTaxonomyLists(supabase),
  ]);
  if (!drill) notFound();

  const kind = drill.kind as DrillKind;
  const editorItems: EditorItem[] = (items ?? []).flatMap((it) => {
    const payload = (it.payload ?? {}) as Record<string, unknown>;
    const raw =
      kind === "ox"
        ? { kind, prompt: it.prompt, answer: it.answer, explanation: it.explanation }
        : kind === "choice"
          ? { kind, prompt: it.prompt, options: payload.options, answer: it.answer, explanation: it.explanation }
          : { kind, prompt: it.prompt, buckets: payload.buckets, tokens: payload.tokens, answer: it.answer, explanation: it.explanation };
    const parsed = drillItemInputSchema.safeParse(raw);
    return parsed.success ? [{ id: it.id, item: parsed.data }] : [];
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">훈련 편집</h1>
        {drill.is_published ? <Badge variant="success">발행됨</Badge> : <Badge variant="outline">초안</Badge>}
      </div>
      <DrillEditor
        drillId={id}
        taxonomy={taxonomy}
        initial={{
          title: drill.title,
          description: drill.description ?? "",
          kind,
          area: (drill.area as PassageSource | null) ?? null,
          workId: drill.work_id,
          conceptIds: (concepts ?? []).map((c) => c.concept_id),
          timeLimitSec: drill.time_limit_sec,
          items: editorItems.length > 0 ? editorItems : undefined,
        } as never}
      />
    </div>
  );
}
