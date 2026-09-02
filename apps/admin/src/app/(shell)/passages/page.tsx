import Link from "next/link";
import { FileUp, Plus } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import type { PassageSource } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import {
  PassagesTableClient,
  type PassageRow,
} from "./passages-table-client";

export const dynamic = "force-dynamic";

export default async function PassagesListPage() {
  const supabase = await createServerSupabaseClient();

  const { data: passages } = await supabase
    .from("passages")
    .select("id, title, source_type, unit_major, unit_minor, created_at")
    .order("created_at", { ascending: false });

  const passageIds = (passages ?? []).map((p) => p.id);
  const counts = new Map<string, number>();
  if (passageIds.length > 0) {
    const { data: qs } = await supabase
      .from("questions")
      .select("passage_id")
      .in("passage_id", passageIds);
    (qs ?? []).forEach((q) => {
      counts.set(q.passage_id, (counts.get(q.passage_id) ?? 0) + 1);
    });
  }

  const rows: PassageRow[] = (passages ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    source_type: p.source_type as PassageSource,
    unit_major: p.unit_major,
    unit_minor: p.unit_minor,
    created_at: p.created_at,
    question_count: counts.get(p.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">지문 / 문항</h1>
          <p className="text-muted-foreground text-sm">
            수능 국어 지문과 문항을 등록해두면 시험지 만들 때 재사용할 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/passages/import">
              <FileUp className="size-4" />CSV 가져오기
            </Link>
          </Button>
          <Button asChild>
            <Link href="/passages/new">
              <Plus className="size-4" />새 지문 등록
            </Link>
          </Button>
        </div>
      </div>

      <PassagesTableClient rows={rows} />
    </div>
  );
}
