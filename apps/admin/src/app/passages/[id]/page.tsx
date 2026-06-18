import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import type { PassageSource, QuestionChoice } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { EditPassageClient } from "./edit-passage-client";

export const dynamic = "force-dynamic";

export default async function EditPassagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: passage } = await supabase
    .from("passages")
    .select("id, title, source_type, content, unit_major, unit_minor")
    .eq("id", id)
    .maybeSingle();
  if (!passage) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select(
      "id, position_in_passage, stem, supplementary, choices, correct_answer, points, difficulty, unit_minor",
    )
    .eq("passage_id", id)
    .order("position_in_passage");

  // 사용 여부 (시험지 매핑)
  const questionIds = (questions ?? []).map((q) => q.id);
  const { count: usedCount } =
    questionIds.length > 0
      ? await supabase
          .from("test_sheet_questions")
          .select("id", { count: "exact", head: true })
          .in("question_id", questionIds)
      : { count: 0 };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/passages">
            <ChevronLeft className="size-4" />
            목록
          </Link>
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">지문 편집</h1>
        <p className="text-muted-foreground text-sm">
          {(usedCount ?? 0) > 0
            ? `이 지문의 문항이 시험지에서 ${usedCount}곳 사용 중이에요. 학생 응시 후엔 일부 정보가 수정/삭제되지 않을 수 있어요.`
            : "이 지문은 아직 시험지에 사용되지 않았어요."}
        </p>
      </div>

      <EditPassageClient
        passageId={id}
        initialPassage={{
          title: passage.title,
          source_type: passage.source_type as PassageSource,
          content: passage.content,
          unit_major: passage.unit_major,
          unit_minor: passage.unit_minor,
        }}
        initialQuestions={(questions ?? []).map((q) => ({
          id: q.id,
          position_in_passage: q.position_in_passage,
          stem: q.stem,
          supplementary: q.supplementary,
          choices: q.choices as QuestionChoice[],
          correct_answer: q.correct_answer,
          points: q.points,
          difficulty: q.difficulty as "상" | "중" | "하" | null,
          unit_minor: q.unit_minor,
        }))}
        usedCount={usedCount ?? 0}
      />
    </div>
  );
}
