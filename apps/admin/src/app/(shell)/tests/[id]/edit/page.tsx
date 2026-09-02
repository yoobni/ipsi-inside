import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import type { TestSheetInput } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { TestComposer, type AvailableQuestion } from "../../test-composer";

export const dynamic = "force-dynamic";

export default async function EditTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: sheet } = await supabase
    .from("test_sheets")
    .select(
      "id, title, description, target_school, target_grade, open_at, due_at, allow_retake, max_attempts",
    )
    .eq("id", id)
    .maybeSingle();
  if (!sheet) notFound();

  const { data: tsq } = await supabase
    .from("test_sheet_questions")
    .select("question_id, position")
    .eq("test_sheet_id", id)
    .order("position");

  const defaultMeta: TestSheetInput = {
    title: sheet.title,
    description: sheet.description,
    target_school: sheet.target_school,
    target_grade: sheet.target_grade,
    open_at: sheet.open_at,
    due_at: sheet.due_at,
    allow_retake: sheet.allow_retake,
    max_attempts: sheet.max_attempts,
  };

  const defaultQuestionIds = (tsq ?? []).map((r) => r.question_id);

  // 전체 available — 같은 picker 표시
  const { data: passages } = await supabase
    .from("passages")
    .select("id, title, source_type, unit_major, unit_minor")
    .order("created_at", { ascending: false });

  const passageIds = (passages ?? []).map((p) => p.id);
  const { data: questions } =
    passageIds.length > 0
      ? await supabase
          .from("questions")
          .select(
            "id, passage_id, position_in_passage, stem, supplementary, choices, correct_answer, points, difficulty, unit_minor",
          )
          .in("passage_id", passageIds)
          .order("position_in_passage")
      : { data: [] };

  const available: AvailableQuestion[] = (questions ?? []).map((q) => {
    const p = (passages ?? []).find((pp) => pp.id === q.passage_id)!;
    return {
      id: q.id,
      passage: {
        id: p.id,
        title: p.title,
        source_type: p.source_type,
        unit_major: p.unit_major,
        unit_minor: p.unit_minor,
      },
      position_in_passage: q.position_in_passage,
      stem: q.stem,
      supplementary: q.supplementary,
      choices: q.choices as { no: number; text: string }[],
      correct_answer: q.correct_answer,
      points: q.points,
      difficulty: q.difficulty,
      unit_minor: q.unit_minor,
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/tests/${id}`}>
            <ChevronLeft className="size-4" />
            돌아가기
          </Link>
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">시험지 편집</h1>
        <p className="text-muted-foreground text-sm">
          학생이 응시를 시작한 시험지는 수정할 수 없어요.
        </p>
      </div>

      <TestComposer
        mode="edit"
        testSheetId={id}
        defaultMeta={defaultMeta}
        defaultQuestionIds={defaultQuestionIds}
        available={available}
      />
    </div>
  );
}
