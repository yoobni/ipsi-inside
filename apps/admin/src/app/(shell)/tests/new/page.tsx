import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TestComposer, type AvailableQuestion } from "../test-composer";

export const dynamic = "force-dynamic";

export default async function NewTestPage() {
  const supabase = await createServerSupabaseClient();

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
          <Link href="/tests">
            <ChevronLeft className="size-4" />
            목록
          </Link>
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">새 시험지</h1>
        <p className="text-muted-foreground text-sm">
          등록된 문항을 골라 시험지를 만들어요. 좌측에서 [추가] → 우측 시험지에 쌓이고,
          순서 조정으로 시험지 번호를 정해요.
        </p>
      </div>

      <TestComposer mode="create" available={available} />
    </div>
  );
}
