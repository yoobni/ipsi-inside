import Link from "next/link";
import { Plus } from "lucide-react";
import { DRILL_KIND_LABEL, PASSAGE_SOURCE_LABEL, type DrillKind, type PassageSource } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DrillsList, type DrillRow } from "./drills-list";

export const dynamic = "force-dynamic";

export default async function DrillsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: drills }, { data: items }, { data: attempts }] = await Promise.all([
    supabase
      .from("drills")
      .select("id, title, kind, area, is_published, published_at, time_limit_sec, created_at, works(title)")
      .order("created_at", { ascending: false }),
    supabase.from("drill_items").select("drill_id"),
    supabase.from("drill_attempts").select("drill_id, correct, total").not("finished_at", "is", null),
  ]);
  const itemCount = new Map<string, number>();
  (items ?? []).forEach((i) => itemCount.set(i.drill_id, (itemCount.get(i.drill_id) ?? 0) + 1));
  const stat = new Map<string, { n: number; correct: number; total: number }>();
  (attempts ?? []).forEach((a) => {
    const s = stat.get(a.drill_id) ?? { n: 0, correct: 0, total: 0 };
    s.n += 1;
    s.correct += a.correct ?? 0;
    s.total += a.total ?? 0;
    stat.set(a.drill_id, s);
  });

  const rows: DrillRow[] = (drills ?? []).map((d) => {
    const w = Array.isArray(d.works) ? d.works[0] : d.works;
    const s = stat.get(d.id);
    return {
      id: d.id,
      title: d.title,
      kind: d.kind as DrillKind,
      area_label: d.area ? PASSAGE_SOURCE_LABEL[d.area as PassageSource] : null,
      work_title: (w as { title: string } | null)?.title ?? null,
      is_published: d.is_published,
      item_count: itemCount.get(d.id) ?? 0,
      attempts: s?.n ?? 0,
      accuracy: s && s.total > 0 ? Math.round((s.correct / s.total) * 100) : null,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">OX 훈련</h1>
          <p className="text-muted-foreground text-sm">
            시험과 별개로 짧게 반복하는 훈련이에요. {Object.values(DRILL_KIND_LABEL).join(" · ")} 세 가지.
            틀린 항목은 바로 다시 나와요. 개념 태그를 달면 취약 개념 분석에 쓰여요.
          </p>
        </div>
        <Button asChild>
          <Link href="/drills/new">
            <Plus className="size-4" />새 훈련
          </Link>
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed py-16 text-center text-sm">
          아직 훈련이 없어요. <Badge variant="outline">새 훈련</Badge>으로 첫 OX 세트를 만들어보세요.
        </div>
      ) : (
        <DrillsList rows={rows} />
      )}
    </div>
  );
}
