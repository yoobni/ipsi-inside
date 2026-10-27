import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Table2 } from "lucide-react";
import type { CourseItemInput } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { todayKst } from "@/lib/kst";
import { CourseDetailClient, type DeliveryRow, type ItemRefs, type SessionData, type StudentLite } from "./course-detail-client";

export const dynamic = "force-dynamic";

type ItemDbRow = {
  session_id: string;
  position: number;
  kind: CourseItemInput["kind"];
  material_id: string | null;
  test_sheet_id: string | null;
  drill_id: string | null;
  guide_id: string | null;
  title: string | null;
  due_days: number | null;
};

function toInput(r: ItemDbRow): CourseItemInput[] {
  switch (r.kind) {
    case "material": return r.material_id ? [{ kind: "material", materialId: r.material_id }] : [];
    case "test": return r.test_sheet_id ? [{ kind: "test", testSheetId: r.test_sheet_id }] : [];
    case "drill": return r.drill_id ? [{ kind: "drill", drillId: r.drill_id }] : [];
    case "guide": return r.guide_id ? [{ kind: "guide", guideId: r.guide_id }] : [];
    case "homework": return r.title ? [{ kind: "homework", title: r.title, dueDays: r.due_days }] : [];
  }
}

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const today = todayKst();

  const [
    { data: course },
    { data: links },
    { data: groups },
    { data: sessions },
    { data: materials },
    { data: tests },
    { data: drills },
    { data: guides },
    { data: students },
    { data: members },
    { data: absents },
  ] = await Promise.all([
    supabase.from("courses").select("id, title, description, archived").eq("id", id).maybeSingle(),
    supabase.from("course_groups").select("group_id").eq("course_id", id),
    supabase.from("student_groups").select("id, name, archived").order("name"),
    supabase.from("course_sessions").select("id, title, summary, position").eq("course_id", id).order("position"),
    supabase.from("materials").select("id, title, audience, is_published").order("created_at", { ascending: false }),
    supabase.from("test_sheets").select("id, title").eq("kind", "regular").order("created_at", { ascending: false }),
    supabase.from("drills").select("id, title, is_published").order("created_at", { ascending: false }),
    supabase.from("guides").select("id, title, status").order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, school, grade")
      .eq("role", "student")
      .eq("status", "approved")
      .order("full_name"),
    supabase.from("group_members").select("group_id, student_id"),
    // 오늘(KST) 결석 표시된 학생 — 수업 진행 처리에서 기본 체크 해제. 'daily' 권한이 없으면 비어 온다.
    supabase.from("daily_attendance").select("student_id").eq("date", today).eq("attendance", "absent"),
  ]);
  if (!course) notFound();

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const [{ data: items }, { data: deliveries }] = sessionIds.length
    ? await Promise.all([
        supabase
          .from("course_session_items")
          .select("session_id, position, kind, material_id, test_sheet_id, drill_id, guide_id, title, due_days")
          .in("session_id", sessionIds)
          .order("position"),
        supabase.from("course_session_deliveries").select("session_id, student_id, kind, delivered_at").in("session_id", sessionIds),
      ])
    : [{ data: [] as ItemDbRow[] }, { data: [] as DeliveryRow[] }];

  const sessionData: SessionData[] = (sessions ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    summary: s.summary,
    items: (items ?? []).filter((i) => i.session_id === s.id).flatMap(toInput),
  }));

  const refs: ItemRefs = {
    materials: (materials ?? []).map((m) => ({ id: m.id, title: m.title, audience: m.audience, published: m.is_published })),
    tests: (tests ?? []).map((t) => ({ id: t.id, title: t.title })),
    drills: (drills ?? []).map((d) => ({ id: d.id, title: d.title, published: d.is_published })),
    guides: (guides ?? []).map((g) => ({ id: g.id, title: g.title, published: g.status === "published" })),
  };

  const studentList: StudentLite[] = (students ?? []).map((s) => ({ id: s.id, name: s.full_name, school: s.school, grade: s.grade }));
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
        students={studentList}
        members={members ?? []}
        deliveries={(deliveries ?? []) as DeliveryRow[]}
        absentIds={(absents ?? []).map((a) => a.student_id)}
      />
    </div>
  );
}
