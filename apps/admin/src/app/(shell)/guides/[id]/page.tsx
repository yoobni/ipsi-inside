import { notFound } from "next/navigation";
import { guideStepPayloadSchema } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { GuideEditor, type EditorStep } from "../guide-editor";
import { loadGuideRefs } from "../refs";

export const dynamic = "force-dynamic";

export default async function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [{ data: guide }, { data: steps }, refs] = await Promise.all([
    supabase.from("guides").select("id, title, summary, work_id, status").eq("id", id).maybeSingle(),
    supabase.from("guide_steps").select("id, position, kind, title, payload").eq("guide_id", id).order("position"),
    loadGuideRefs(supabase),
  ]);
  if (!guide) notFound();

  const editorSteps: EditorStep[] = (steps ?? []).flatMap((s) => {
    const parsed = guideStepPayloadSchema.safeParse({ kind: s.kind, ...(s.payload as Record<string, unknown>) });
    return parsed.success ? [{ id: s.id, title: s.title, payload: parsed.data }] : [];
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">가이드 편집</h1>
        {guide.status === "published" ? <Badge variant="success">발행됨</Badge> : <Badge variant="outline">초안</Badge>}
      </div>
      <GuideEditor
        guideId={id}
        refs={refs}
        initial={{ title: guide.title, summary: guide.summary ?? "", workId: guide.work_id, steps: editorSteps.length > 0 ? editorSteps : [] }}
      />
    </div>
  );
}
