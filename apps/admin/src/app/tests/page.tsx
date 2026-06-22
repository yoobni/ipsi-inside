import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TestsTableClient, type SheetRow } from "./tests-table-client";

export const dynamic = "force-dynamic";

export default async function TestsListPage() {
  const supabase = await createServerSupabaseClient();

  const { data: sheets } = await supabase
    .from("test_sheets")
    .select(
      "id, title, target_school, target_grade, open_at, due_at, allow_retake, created_at",
    )
    .order("created_at", { ascending: false });

  const sheetIds = (sheets ?? []).map((s) => s.id);

  const qCount = new Map<string, number>();
  const aCount = new Map<string, number>();
  if (sheetIds.length > 0) {
    const [tsq, ta] = await Promise.all([
      supabase
        .from("test_sheet_questions")
        .select("test_sheet_id")
        .in("test_sheet_id", sheetIds),
      supabase
        .from("test_assignments")
        .select("test_sheet_id")
        .in("test_sheet_id", sheetIds),
    ]);
    (tsq.data ?? []).forEach((r) =>
      qCount.set(r.test_sheet_id, (qCount.get(r.test_sheet_id) ?? 0) + 1),
    );
    (ta.data ?? []).forEach((r) =>
      aCount.set(r.test_sheet_id, (aCount.get(r.test_sheet_id) ?? 0) + 1),
    );
  }

  const rows: SheetRow[] = (sheets ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    target_school: s.target_school,
    target_grade: s.target_grade,
    open_at: s.open_at,
    due_at: s.due_at,
    allow_retake: s.allow_retake,
    created_at: s.created_at,
    question_count: qCount.get(s.id) ?? 0,
    assigned_count: aCount.get(s.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">시험 관리</h1>
          <p className="text-muted-foreground text-sm">
            등록된 문항을 골라 시험지를 만들고 학교/학생에게 배정해요.
          </p>
        </div>
        <Button asChild>
          <Link href="/tests/new">
            <Plus className="size-4" />새 시험지
          </Link>
        </Button>
      </div>

      <TestsTableClient sheets={rows} />
    </div>
  );
}
