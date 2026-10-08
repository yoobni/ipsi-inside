import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ColumnsList, type ColumnRow } from "./columns-list";
import { CategoryFilter, CATEGORY_NONE } from "./category-filter";

export const dynamic = "force-dynamic";

export default async function ColumnsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createServerSupabaseClient();

  let colsQuery = supabase
    .from("columns")
    .select("id, title, category_id, is_published, published_at, created_at")
    .order("created_at", { ascending: false });
  if (category === CATEGORY_NONE) colsQuery = colsQuery.is("category_id", null);
  else if (category) colsQuery = colsQuery.eq("category_id", category);

  const [{ data: cols }, { data: reads }, { count: studentTotal }, { data: categories }] =
    await Promise.all([
      colsQuery,
      supabase.from("column_reads").select("column_id"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .eq("status", "approved"),
      // 보관된 것도 포함 — 보관된 카테고리를 단 칼럼의 배지는 계속 보여야 한다
      supabase.from("column_categories").select("id, label, archived").order("position"),
    ]);

  const readCount = new Map<string, number>();
  (reads ?? []).forEach((r) => {
    readCount.set(r.column_id, (readCount.get(r.column_id) ?? 0) + 1);
  });
  const labelOf = new Map((categories ?? []).map((c) => [c.id, c.label] as const));

  const rows: ColumnRow[] = (cols ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    category_label: c.category_id ? (labelOf.get(c.category_id) ?? null) : null,
    is_published: c.is_published,
    published_at: c.published_at,
    created_at: c.created_at,
    read_count: readCount.get(c.id) ?? 0,
  }));

  const filterChoices = (categories ?? [])
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, label: c.label }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">칼럼</h1>
          <p className="text-muted-foreground text-sm">
            국어 개념·독해 노하우를 글로 올려요. 학생이 읽고 [읽기 완료]를 누르면
            여기서 몇 명이 읽었는지 볼 수 있어요.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline">
            <Link href="/columns/categories">
              <Settings className="size-4" />
              카테고리 관리
            </Link>
          </Button>
          <Button asChild>
            <Link href="/columns/new">
              <Plus className="size-4" />새 칼럼
            </Link>
          </Button>
        </div>
      </div>

      <CategoryFilter categories={filterChoices} value={category ?? null} />

      <ColumnsList
        rows={rows}
        studentTotal={studentTotal ?? 0}
        filtered={Boolean(category)}
      />
    </div>
  );
}
