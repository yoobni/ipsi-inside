import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import {
  plannerTemplatePayloadSchema,
  weekStartOf,
  type PlannerBlockInput,
} from "@ipsi/types";
import { todayKst } from "@/lib/kst";
import {
  PlannerClient,
  type PlannerStudent,
  type PlannerTagChoice,
  type PlannerTemplateChoice,
} from "./planner-client";

export const dynamic = "force-dynamic";

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; group?: string; week?: string }>;
}) {
  const sp = await searchParams;
  const groupId = sp.group ?? null;
  const weekStart =
    sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week)
      ? weekStartOf(sp.week)
      : weekStartOf(todayKst());

  const supabase = await createServerSupabaseClient();

  const [{ data: groups }, { data: tags }, { data: templates }] =
    await Promise.all([
      supabase
        .from("student_groups")
        .select("id, name")
        .eq("archived", false)
        .order("name"),
      supabase
        .from("planner_tags")
        .select("id, name, color")
        .eq("archived", false)
        .order("position"),
      supabase
        .from("planner_templates")
        .select("id, name, payload")
        .order("created_at", { ascending: false }),
    ]);

  // 그룹 필터가 걸리면 그 그룹 멤버만 학생 후보로 노출
  let memberIds: string[] | null = null;
  if (groupId) {
    const { data: members } = await supabase
      .from("group_members")
      .select("student_id")
      .eq("group_id", groupId);
    memberIds = (members ?? []).map((m) => m.student_id);
  }

  let studentQuery = supabase
    .from("profiles")
    .select("id, full_name, school, grade")
    .eq("role", "student")
    .eq("status", "approved")
    .order("full_name");
  if (memberIds) {
    // 멤버가 0명인 그룹이면 빈 결과가 나와야 한다 (in([])는 아무것도 매칭 안 함)
    studentQuery = studentQuery.in("id", memberIds);
  }
  const { data: students } = await studentQuery;

  const studentRows: PlannerStudent[] = (students ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    school: s.school,
    grade: s.grade,
  }));

  const selectedStudentId =
    sp.student && studentRows.some((s) => s.id === sp.student)
      ? sp.student
      : (studentRows[0]?.id ?? null);

  // 선택된 학생의 해당 주차 로드
  let weekId: string | null = null;
  let weekStatus: "draft" | "published" = "draft";
  let weeklyComment: string | null = null;
  let blocks: PlannerBlockInput[] = [];

  if (selectedStudentId) {
    const { data: week } = await supabase
      .from("planner_weeks")
      .select("id, status, weekly_comment")
      .eq("student_id", selectedStudentId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (week) {
      weekId = week.id;
      weekStatus = week.status;
      weeklyComment = week.weekly_comment;

      const { data: blockRows } = await supabase
        .from("planner_blocks")
        .select("id, day_of_week, start_min, end_min, kind, label, color, memo")
        .eq("week_id", week.id)
        .order("day_of_week")
        .order("start_min");

      const blockIds = (blockRows ?? []).map((b) => b.id);
      const { data: taskRows } = blockIds.length
        ? await supabase
            .from("planner_tasks")
            .select("id, block_id, tag_id, title, position")
            .in("block_id", blockIds)
            .order("position")
        : { data: [] };

      blocks = (blockRows ?? []).map((b) => ({
        id: b.id,
        day_of_week: b.day_of_week,
        start_min: b.start_min,
        end_min: b.end_min,
        kind: b.kind,
        label: b.label,
        color: b.color,
        memo: b.memo,
        tasks: (taskRows ?? [])
          .filter((t) => t.block_id === b.id)
          .map((t) => ({ id: t.id, title: t.title, tag_id: t.tag_id })),
      }));
    }
  }

  const tagChoices: PlannerTagChoice[] = (tags ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }));

  // 내용이 깨진 템플릿은 불러오기 목록에서 빼둔다 (관리 페이지에서는 표시)
  const templateChoices: PlannerTemplateChoice[] = (templates ?? []).flatMap(
    (t) => {
      const parsed = plannerTemplatePayloadSchema.safeParse(t.payload);
      if (!parsed.success) return [];
      return [{ id: t.id, name: t.name, blocks: parsed.data.blocks }];
    },
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">주간 플래너</h1>
        <p className="text-muted-foreground text-sm">
          학생별 주간 국어 학습 일정을 배정해요. 고정 일정은 색상 블록으로,
          국어 시간은 세부 과제와 함께 넣어요. 발행해야 학생에게 보입니다.
        </p>
      </div>

      <PlannerClient
        students={studentRows}
        groups={(groups ?? []).map((g) => ({ id: g.id, name: g.name }))}
        selectedGroupId={groupId}
        selectedStudentId={selectedStudentId}
        weekStart={weekStart}
        weekId={weekId}
        weekStatus={weekStatus}
        weeklyComment={weeklyComment}
        initialBlocks={blocks}
        tags={tagChoices}
        templates={templateChoices}
      />
    </div>
  );
}
