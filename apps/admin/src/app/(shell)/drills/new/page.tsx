import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { loadTaxonomyLists } from "../../passages/question-extras";
import { DrillEditor } from "../drill-editor";

export const dynamic = "force-dynamic";

export default async function NewDrillPage() {
  const taxonomy = await loadTaxonomyLists(await createServerSupabaseClient());
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">새 훈련</h1>
        <p className="text-muted-foreground text-sm">5~10문항으로 짧게. 저장 후 목록에서 발행하면 학생에게 보여요.</p>
      </div>
      <DrillEditor taxonomy={taxonomy} />
    </div>
  );
}
