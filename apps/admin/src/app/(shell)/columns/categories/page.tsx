import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CategoriesEditor, type CategoryRow } from "./categories-editor";

export const dynamic = "force-dynamic";

export default async function ColumnCategoriesPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("column_categories")
    .select("id, label, archived, position")
    .order("position");

  const rows: CategoryRow[] = (data ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    archived: c.archived,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/columns">
          <ChevronLeft className="size-4" />
          칼럼
        </Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">칼럼 카테고리</h1>
        <p className="text-muted-foreground text-sm">
          칼럼을 분류해요(문학 / 독서 / 언어와 매체 / 공부법 / 입시·공지 …). 보관하면
          새 칼럼에서 고를 수 없게 되고, 이미 그 카테고리를 단 칼럼은 그대로 유지돼요.
        </p>
      </div>
      <CategoriesEditor rows={rows} />
    </div>
  );
}
