import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { GuideEditor } from "../guide-editor";
import { loadGuideRefs } from "../refs";

export const dynamic = "force-dynamic";

export default async function NewGuidePage() {
  const refs = await loadGuideRefs(await createServerSupabaseClient());
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">새 학습 가이드</h1>
        <p className="text-muted-foreground text-sm">기본 5단계가 깔려 있어요. 순서를 바꾸거나 단계를 더하세요. 저장 후 목록에서 발행.</p>
      </div>
      <GuideEditor refs={refs} />
    </div>
  );
}
