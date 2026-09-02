import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ColumnsList, type ColumnRow } from "./columns-list";

export const dynamic = "force-dynamic";

export default async function ColumnsPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: cols }, { data: reads }, { count: studentTotal }] =
    await Promise.all([
      supabase
        .from("columns")
        .select("id, title, is_published, published_at, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("column_reads").select("column_id"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .eq("status", "approved"),
    ]);

  const readCount = new Map<string, number>();
  (reads ?? []).forEach((r) => {
    readCount.set(r.column_id, (readCount.get(r.column_id) ?? 0) + 1);
  });

  const rows: ColumnRow[] = (cols ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    is_published: c.is_published,
    published_at: c.published_at,
    created_at: c.created_at,
    read_count: readCount.get(c.id) ?? 0,
  }));

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
        <Button asChild>
          <Link href="/columns/new">
            <Plus className="size-4" />새 칼럼
          </Link>
        </Button>
      </div>
      <ColumnsList rows={rows} studentTotal={studentTotal ?? 0} />
    </div>
  );
}
