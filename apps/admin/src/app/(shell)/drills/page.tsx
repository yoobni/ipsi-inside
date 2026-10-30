import Link from "next/link";
import { MessageSquareText, Plus } from "lucide-react";
import { DRILL_KIND_LABEL, PASSAGE_SOURCE_LABEL, type DrillKind, type PassageSource } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { formatKstMonthDay } from "@/lib/kst";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DrillsList, type DrillRow } from "./drills-list";

export const dynamic = "force-dynamic";

export default async function DrillsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: drills }, { data: items }, { data: attempts }, { data: shared }] = await Promise.all([
    supabase
      .from("drills")
      .select("id, title, kind, area, is_published, published_at, time_limit_sec, created_at, works(title)")
      .order("created_at", { ascending: false }),
    supabase.from("drill_items").select("drill_id"),
    supabase.from("drill_attempts").select("drill_id, correct, total").not("finished_at", "is", null),
    // 학생이 보낸 결과 — 미확인 먼저, 최근 20건
    supabase
      .from("drill_attempts")
      .select("id, student_id, drill_id, correct, total, shared_at, share_note, share_ack_at")
      .not("shared_at", "is", null)
      .order("share_ack_at", { ascending: true, nullsFirst: true })
      .order("shared_at", { ascending: false })
      .limit(20),
  ]);
  const sharedStudentIds = [...new Set((shared ?? []).map((a) => a.student_id))];
  const { data: sharedStudents } = sharedStudentIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", sharedStudentIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameOf = new Map((sharedStudents ?? []).map((p) => [p.id, p.full_name]));
  const drillTitle = new Map((drills ?? []).map((d) => [d.id, d.title]));
  const unacked = (shared ?? []).filter((a) => !a.share_ack_at).length;
  const itemCount = new Map<string, number>();
  (items ?? []).forEach((i) => itemCount.set(i.drill_id, (itemCount.get(i.drill_id) ?? 0) + 1));
  const stat = new Map<string, { n: number; correct: number; total: number }>();
  (attempts ?? []).forEach((a) => {
    const s = stat.get(a.drill_id) ?? { n: 0, correct: 0, total: 0 };
    s.n += 1;
    s.correct += a.correct ?? 0;
    s.total += a.total ?? 0;
    stat.set(a.drill_id, s);
  });

  const rows: DrillRow[] = (drills ?? []).map((d) => {
    const w = Array.isArray(d.works) ? d.works[0] : d.works;
    const s = stat.get(d.id);
    return {
      id: d.id,
      title: d.title,
      kind: d.kind as DrillKind,
      area_label: d.area ? PASSAGE_SOURCE_LABEL[d.area as PassageSource] : null,
      work_title: (w as { title: string } | null)?.title ?? null,
      is_published: d.is_published,
      item_count: itemCount.get(d.id) ?? 0,
      attempts: s?.n ?? 0,
      accuracy: s && s.total > 0 ? Math.round((s.correct / s.total) * 100) : null,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">OX 훈련</h1>
          <p className="text-muted-foreground text-sm">
            시험과 별개로 짧게 반복하는 훈련이에요. {Object.values(DRILL_KIND_LABEL).join(" · ")} 세 가지.
            틀린 항목은 바로 다시 나와요. 개념 태그를 달면 취약 개념 분석에 쓰여요.
          </p>
        </div>
        <Button asChild>
          <Link href="/drills/new">
            <Plus className="size-4" />새 훈련
          </Link>
        </Button>
      </div>
      {(shared ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <MessageSquareText className="size-4" />
            학생이 보낸 결과
            {unacked > 0 && <Badge variant="warning">미확인 {unacked}</Badge>}
          </h2>
          <ul className="divide-y rounded-md border">
            {(shared ?? []).map((a) => (
              <li key={a.id}>
                <Link href={`/drills/attempts/${a.id}`} className="hover:bg-muted/50 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="font-medium">{nameOf.get(a.student_id) ?? "학생"}</span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate">{drillTitle.get(a.drill_id) ?? "훈련"}</span>
                  <span className="tabular-nums">{a.correct ?? 0}/{a.total ?? 0}</span>
                  {a.share_note && <Badge variant="outline">메모</Badge>}
                  <span className="text-muted-foreground text-xs">{formatKstMonthDay(a.shared_at!)}</span>
                  {a.share_ack_at ? <Badge variant="success">확인</Badge> : <Badge variant="warning">미확인</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed py-16 text-center text-sm">
          아직 훈련이 없어요. <Badge variant="outline">새 훈련</Badge>으로 첫 OX 세트를 만들어보세요.
        </div>
      ) : (
        <DrillsList rows={rows} />
      )}
    </div>
  );
}
