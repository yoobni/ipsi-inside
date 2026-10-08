import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PASSAGE_SOURCE_LABEL, type PassageSource } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { getStaffContext } from "@/lib/auth";
import { TaxonomyClient } from "./taxonomy-client";

export const dynamic = "force-dynamic";

/**
 * 문항 태그 사전 — 유형 · 작품/제재 · 기출 출처 · 개념.
 * 시험 분석·취약점 추천·허브가 이 사전을 축으로 돈다. 태깅 현황(미분류 수)도 같이 보여준다.
 */
export default async function TaxonomyPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  const { supabase } = ctx;

  const [
    { data: types },
    { data: works },
    { data: sources },
    { data: concepts },
    { count: questionTotal },
    { count: untyped },
    { count: passageTotal },
    { count: unworked },
    { count: explained },
  ] = await Promise.all([
    supabase.from("question_types").select("id, area, label, position, archived").order("area").order("position"),
    supabase.from("works").select("id, title, author, genre, era, archived").order("archived").order("title"),
    supabase
      .from("exam_sources")
      .select("id, label, year, month, exam_kind, grade, archived")
      .order("archived")
      .order("year", { ascending: false, nullsFirst: false })
      .order("month", { ascending: false, nullsFirst: false }),
    supabase.from("concepts").select("id, title, area, parent_id, archived").order("archived").order("position"),
    supabase.from("questions").select("id", { count: "exact", head: true }),
    supabase.from("questions").select("id", { count: "exact", head: true }).is("type_id", null),
    supabase.from("passages").select("id", { count: "exact", head: true }),
    supabase.from("passages").select("id", { count: "exact", head: true }).is("work_id", null),
    supabase.from("question_explanations").select("question_id", { count: "exact", head: true }),
  ]);

  // 유형별 문항 수(태깅 현황)
  const { data: typeCounts } = await supabase.from("questions").select("type_id").not("type_id", "is", null);
  const countByType = new Map<string, number>();
  (typeCounts ?? []).forEach((q) => {
    if (q.type_id) countByType.set(q.type_id, (countByType.get(q.type_id) ?? 0) + 1);
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/passages">
          <ChevronLeft className="size-4" />
          지문/문항
        </Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">문항 태그 사전</h1>
        <p className="text-muted-foreground text-sm">
          유형·작품·출처·개념을 여기서 정해두면 지문/문항 등록과 CSV에서 고를 수 있어요. 시험 분석의
          &ldquo;유형별 정답률&rdquo;, 취약점 추천, 작품 허브가 전부 이 태그로 집계돼요. 보관하면 새로 고를 수
          없고, 이미 단 문항은 그대로예요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="문항" value={`${questionTotal ?? 0}`} sub={`유형 미분류 ${untyped ?? 0}`} warn={(untyped ?? 0) > 0} />
        <Stat label="지문" value={`${passageTotal ?? 0}`} sub={`작품/제재 미지정 ${unworked ?? 0}`} warn={(unworked ?? 0) > 0} />
        <Stat label="해설 있는 문항" value={`${explained ?? 0}`} sub={`전체 ${questionTotal ?? 0}`} />
        <Stat label="사전" value={`${(types ?? []).length} · ${(works ?? []).length} · ${(sources ?? []).length} · ${(concepts ?? []).length}`} sub="유형 · 작품 · 출처 · 개념" />
      </div>

      <TaxonomyClient
        types={(types ?? []).map((t) => ({ ...t, area: t.area as PassageSource, count: countByType.get(t.id) ?? 0 }))}
        works={works ?? []}
        sources={sources ?? []}
        concepts={(concepts ?? []).map((c) => ({ ...c, area: (c.area as PassageSource | null) ?? null }))}
        areaLabel={PASSAGE_SOURCE_LABEL}
      />
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className={warn ? "text-amber-600 dark:text-amber-400 text-[11px]" : "text-muted-foreground text-[11px]"}>{sub}</p>
    </div>
  );
}
