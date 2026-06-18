import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import type { TestSheetWithQuestions } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { EditTestSheetClient } from "./edit-test-sheet-client";

export const dynamic = "force-dynamic";

export default async function EditTestSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: sheet } = await supabase
    .from("test_sheets")
    .select("title, target_school, target_grade, test_date")
    .eq("id", id)
    .maybeSingle();

  if (!sheet) notFound();

  const { data: questions } = await supabase
    .from("test_questions")
    .select(
      "question_no, correct_answer, unit_major, unit_minor, difficulty, points",
    )
    .eq("test_sheet_id", id)
    .order("question_no");

  const defaultValues: TestSheetWithQuestions = {
    meta: {
      title: sheet.title,
      targetSchool: sheet.target_school,
      targetGrade: sheet.target_grade,
      testDate: sheet.test_date,
    },
    questions: (questions ?? []).map((q) => ({
      question_no: q.question_no,
      correct_answer: q.correct_answer,
      unit_major: q.unit_major,
      unit_minor: q.unit_minor,
      difficulty: q.difficulty,
      points: q.points,
    })),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/tests/${id}`}>
            <ChevronLeft className="size-4" />
            시험지로 돌아가기
          </Link>
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">시험지 편집</h1>
        <p className="text-muted-foreground text-sm">
          학생 답안이 입력된 시험지는 편집할 수 없어요.
        </p>
      </div>

      <EditTestSheetClient testSheetId={id} defaultValues={defaultValues} />
    </div>
  );
}
