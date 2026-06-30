import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { GroupsClient, type GroupRow, type StudentRow } from "./groups-client";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: groups }, { data: memberships }, { data: students }] =
    await Promise.all([
      supabase
        .from("student_groups")
        .select("id, name, color, description, archived, created_at")
        .order("archived")
        .order("name"),
      supabase.from("group_members").select("group_id, student_id"),
      supabase
        .from("profiles")
        .select("id, full_name, school, grade")
        .eq("role", "student")
        .eq("status", "approved")
        .order("full_name"),
    ]);

  const groupRows: GroupRow[] = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    description: g.description,
    archived: g.archived,
    created_at: g.created_at,
    member_ids: (memberships ?? [])
      .filter((m) => m.group_id === g.id)
      .map((m) => m.student_id),
  }));

  const studentRows: StudentRow[] = (students ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    school: s.school,
    grade: s.grade,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">그룹(반)</h1>
        <p className="text-muted-foreground text-sm">
          학생을 묶는 그룹을 만들어요. 자료 배부·시험 배정·일일 마킹에서 이
          그룹으로 대상을 한 번에 지정할 수 있어요. 그룹에 학생을 넣으면 그
          그룹에 배부된 자료·시험이 자동으로 따라가요.
        </p>
      </div>

      <GroupsClient groups={groupRows} students={studentRows} />
    </div>
  );
}
