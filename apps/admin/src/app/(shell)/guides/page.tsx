import Link from "next/link";
import { BookOpenCheck, Plus, Trash2 } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GuideRowActions } from "./guide-row-actions";

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: guides }, { data: steps }, { data: progress }] = await Promise.all([
    supabase.from("guides").select("id, title, summary, status, work_id, created_at, works(title)").order("created_at", { ascending: false }),
    supabase.from("guide_steps").select("guide_id"),
    supabase.from("guide_progress").select("guide_id, student_id"),
  ]);
  const stepCount = new Map<string, number>();
  (steps ?? []).forEach((s) => stepCount.set(s.guide_id, (stepCount.get(s.guide_id) ?? 0) + 1));
  const learners = new Map<string, Set<string>>();
  (progress ?? []).forEach((p) => learners.set(p.guide_id, (learners.get(p.guide_id) ?? new Set()).add(p.student_id)));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">학습 가이드</h1>
          <p className="text-muted-foreground text-sm">
            작품 하나를 사이트 안에서 처음부터 끝까지 공부하는 단계형 자습서예요. 핵심 가이드 → 지문 읽기 →
            시각 자료 → OX → 관련 문제 → 복습 → 정리. 중요 작품 몇 개부터 시범으로.
          </p>
        </div>
        <Button asChild>
          <Link href="/guides/new"><Plus className="size-4" />새 가이드</Link>
        </Button>
      </div>

      {(guides ?? []).length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed py-16 text-center text-sm">
          아직 가이드가 없어요. 태그 사전에 작품을 먼저 등록하면 작품에 연결할 수 있어요.
        </div>
      ) : (
        <ul className="space-y-2">
          {(guides ?? []).map((g) => {
            const w = Array.isArray(g.works) ? g.works[0] : g.works;
            return (
              <li key={g.id} className="flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
                <Link href={`/guides/${g.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
                  <BookOpenCheck className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {(w as { title: string } | null)?.title ? `${(w as { title: string }).title} · ` : ""}
                      {stepCount.get(g.id) ?? 0}단계 · 학습 중 {learners.get(g.id)?.size ?? 0}명
                    </p>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {g.status === "published" ? <Badge variant="success">발행됨</Badge> : <Badge variant="outline">초안</Badge>}
                  <GuideRowActions id={g.id} title={g.title} published={g.status === "published"} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-muted-foreground flex items-center gap-1 text-[11px]"><Trash2 className="size-3" /> 삭제하면 학생 진도도 함께 지워져요.</p>
    </div>
  );
}
