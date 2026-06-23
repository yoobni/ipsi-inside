import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import type { MaterialAudience } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import {
  MaterialsTableClient,
  type MaterialRow,
} from "./materials-table-client";

export const dynamic = "force-dynamic";

export default async function MaterialsListPage() {
  const supabase = await createServerSupabaseClient();

  const { data: materials } = await supabase
    .from("materials")
    .select(
      "id, title, audience, file_name, file_size_bytes, is_published, published_at, expires_at, created_at",
    )
    .order("created_at", { ascending: false });

  const materialIds = (materials ?? []).map((m) => m.id);
  const targetCounts = new Map<string, number>();
  if (materialIds.length > 0) {
    const { data: assigns } = await supabase
      .from("material_assignments")
      .select("material_id")
      .in("material_id", materialIds);
    (assigns ?? []).forEach((a) => {
      targetCounts.set(
        a.material_id,
        (targetCounts.get(a.material_id) ?? 0) + 1,
      );
    });
  }

  const rows: MaterialRow[] = (materials ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    audience: m.audience as MaterialAudience,
    file_name: m.file_name,
    file_size_bytes: m.file_size_bytes,
    is_published: m.is_published,
    published_at: m.published_at,
    expires_at: m.expires_at,
    created_at: m.created_at,
    target_count: targetCounts.get(m.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">자료 배부</h1>
          <p className="text-muted-foreground text-sm">
            PDF 자료를 학생/학부모에게 배부해요. 광역(전체/학생/학부모) 또는
            학교·학생 단위 핀포인트로 발송 가능.
          </p>
        </div>
        <Button asChild>
          <Link href="/materials/new">
            <Plus className="size-4" />새 자료 업로드
          </Link>
        </Button>
      </div>

      <MaterialsTableClient rows={rows} />
    </div>
  );
}
