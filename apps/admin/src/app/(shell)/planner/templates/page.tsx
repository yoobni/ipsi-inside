import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import {
  plannerTemplatePayloadSchema,
  weekStartOf,
  addDaysIso,
} from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { todayKst } from "@/lib/kst";
import {
  TemplatesClient,
  type TemplateRow,
  type StudentChoice,
} from "./templates-client";

export const dynamic = "force-dynamic";

export default async function PlannerTemplatesPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: templates }, { data: groups }, { data: students }] =
    await Promise.all([
      supabase
        .from("planner_templates")
        .select("id, name, description, payload, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("student_groups")
        .select("id, name")
        .eq("archived", false)
        .order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, school, grade")
        .eq("role", "student")
        .eq("status", "approved")
        .order("full_name"),
    ]);

  const rows: TemplateRow[] = (templates ?? []).map((t) => {
    const parsed = plannerTemplatePayloadSchema.safeParse(t.payload);
    const blocks = parsed.success ? parsed.data.blocks : [];
    const koreanMinutes = blocks
      .filter((b) => b.kind === "korean")
      .reduce((sum, b) => sum + (b.end_min - b.start_min), 0);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      created_at: t.created_at,
      block_count: blocks.length,
      korean_minutes: koreanMinutes,
      task_count: blocks.reduce((sum, b) => sum + (b.tasks?.length ?? 0), 0),
      damaged: !parsed.success,
    };
  });

  const studentChoices: StudentChoice[] = (students ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    school: s.school,
    grade: s.grade,
  }));

  // 기본 배정 주차는 '다음 주' — 보통 미리 짜서 내려보낸다
  const defaultWeek = addDaysIso(weekStartOf(todayKst()), 7);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">플래너 템플릿</h1>
          <p className="text-muted-foreground text-sm">
            자주 쓰는 표준 주간 국어 루틴을 저장해 두고, 여러 학생·그룹에 한
            번에 배정해요. 배정 후 학생별로 수정할 수 있어요.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/planner">
            <ChevronLeft /> 플래너로
          </Link>
        </Button>
      </div>

      <TemplatesClient
        templates={rows}
        students={studentChoices}
        groups={(groups ?? []).map((g) => ({ id: g.id, name: g.name }))}
        defaultWeekStart={defaultWeek}
      />
    </div>
  );
}
