import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Table2 } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { itemRowToInput, type ItemDbRow } from "../item-row";
import { CourseDetailClient, type DeliveryRow, type ItemRefs, type SessionData } from "./course-detail-client";

export const dynamic = "force-dynamic";

/**
 * 코스 상세. 여기서는 **이 코스의 항목이 가리키는** 자료·시험지·훈련·가이드만 읽는다(제목·경고 표시용).
 * 피커 선택지 전체와 학생 명단은 편집기·배부 시트가 열릴 때 액션으로 따로 읽는다.
 */
export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: course }, { data: links }, { data: groups }, { data: sessions }] = await Promise.all([
    supabase.from("courses").select("id, title, description, archived").eq("id", id).maybeSingle(),
    supabase.from("course_groups").select("group_id").eq("course_id", id),
    supabase.from("student_groups").select("id, name, archived").order("name"),
    supabase.from("course_sessions").select("id, title, summary, position").eq("course_id", id).order("position"),
  ]);
  if (!course) notFound();

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const [{ data: items }, { data: deliveries }] = sessionIds.length
    ? await Promise.all([
        supabase
          .from("course_session_items")
          .select("id, session_id, position, kind, material_id, test_sheet_id, drill_id, guide_id, title, due_days")
          .in("session_id", sessionIds)
          .order("position"),
        supabase.from("course_session_deliveries").select("session_id, student_id, kind, delivered_at").in("session_id", sessionIds),
      ])
    : [{ data: [] as (ItemDbRow & { session_id: string })[] }, { data: [] as DeliveryRow[] }];

  const used = (k: "material_id" | "test_sheet_id" | "drill_id" | "guide_id") => [
    ...new Set((items ?? []).flatMap((i) => (i[k] ? [i[k] as string] : []))),
  ];
  const [materialIds, sheetIds, drillIds, guideIds] = [used("material_id"), used("test_sheet_id"), used("drill_id"), used("guide_id")];
  const none = Promise.resolve({ data: [] as never[] });
  const [{ data: materials }, { data: tests }, { data: drills }, { data: guides }] = await Promise.all([
    materialIds.length ? supabase.from("materials").select("id, title, audience, is_published").in("id", materialIds) : none,
    sheetIds.length ? supabase.from("test_sheets").select("id, title").in("id", sheetIds) : none,
    drillIds.length ? supabase.from("drills").select("id, title, is_published").in("id", drillIds) : none,
    guideIds.length ? supabase.from("guides").select("id, title, status").in("id", guideIds) : none,
  ]);

  const sessionData: SessionData[] = (sessions ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    summary: s.summary,
    items: (items ?? []).filter((i) => i.session_id === s.id).flatMap(itemRowToInput),
  }));

  const refs: ItemRefs = {
    materials: (materials ?? []).map((m) => ({ id: m.id, title: m.title, audience: m.audience, published: m.is_published })),
    tests: (tests ?? []).map((t) => ({ id: t.id, title: t.title })),
    drills: (drills ?? []).map((d) => ({ id: d.id, title: d.title, published: d.is_published })),
    guides: (guides ?? []).map((g) => ({ id: g.id, title: g.title, published: g.status === "published" })),
  };

  const visibleGroups = (groups ?? []).map((g) => ({ id: g.id, name: g.name, archived: g.archived }));
  const linkedIds = new Set((links ?? []).map((l) => l.group_id));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Link href="/courses" className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline">
            <ArrowLeft className="size-3" />
            코스 목록
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight break-all">{course.title}</h1>
            {course.archived && <Badge variant="outline">보관됨</Badge>}
          </div>
          {course.description && <p className="text-muted-foreground text-sm">{course.description}</p>}
        </div>
        <Button asChild variant="outline" className="self-start">
          <Link href={`/courses/${id}/progress`}>
            <Table2 className="size-4" />
            진도표
          </Link>
        </Button>
      </div>

      <CourseDetailClient
        course={{ id: course.id, title: course.title, description: course.description, archived: course.archived }}
        linkedGroupIds={[...linkedIds]}
        groups={visibleGroups}
        sessions={sessionData}
        refs={refs}
        deliveries={(deliveries ?? []) as DeliveryRow[]}
      />
    </div>
  );
}
