import Link from "next/link";
import { Download, LayoutGrid } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { todayKst } from "@/lib/kst";
import { DailyTable } from "./daily-table";
import { GroupFilter } from "./group-filter";

export const dynamic = "force-dynamic";

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; group?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayKst();
  const groupId = sp.group ?? null;

  const supabase = await createServerSupabaseClient();

  // 그룹 목록(필터용) + 선택 그룹의 멤버
  const { data: groups } = await supabase
    .from("student_groups")
    .select("id, name")
    .eq("archived", false)
    .order("name");

  let memberIds: string[] | null = null;
  if (groupId) {
    const { data: members } = await supabase
      .from("group_members")
      .select("student_id")
      .eq("group_id", groupId);
    memberIds = (members ?? []).map((m) => m.student_id);
  }

  // 활성 학생 (그룹 필터 적용)
  let studentQuery = supabase
    .from("profiles")
    .select("id, full_name, school, grade")
    .eq("role", "student")
    .eq("status", "approved")
    .order("full_name");
  if (memberIds !== null) {
    studentQuery = studentQuery.in(
      "id",
      memberIds.length > 0 ? memberIds : ["00000000-0000-0000-0000-000000000000"],
    );
  }
  const { data: students } = await studentQuery;

  // 해당 날짜 기록
  const studentIds = (students ?? []).map((s) => s.id);
  const { data: rows } =
    studentIds.length > 0
      ? await supabase
          .from("daily_attendance")
          .select(
            "student_id, attendance, homework_grade, test_score, note, updated_at",
          )
          .eq("date", date)
          .in("student_id", studentIds)
      : { data: [] };

  const rowMap = new Map(
    (rows ?? []).map((r) => [r.student_id, r] as const),
  );

  const studentsWithData = (students ?? []).map((s) => ({
    student: s,
    record: rowMap.get(s.id),
  }));

  // 기본: 최근 30일
  const exportTo = date;
  const exportFromDate = new Date(`${date}T00:00:00Z`);
  exportFromDate.setUTCDate(exportFromDate.getUTCDate() - 29);
  const exportFrom = exportFromDate.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">일일 마킹</h1>
          <p className="text-muted-foreground text-sm">
            학생별 출석/과제/테스트 점수를 빠르게 기록해요. 변경하면 즉시 저장돼요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GroupFilter groups={groups ?? []} value={groupId} />
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/daily/board${groupId ? `?group=${groupId}` : ""}`}
            >
              <LayoutGrid className="size-4" /> 한눈에 보기
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/daily/export?from=${exportFrom}&to=${exportTo}`}
              download
            >
              <Download className="size-4" /> CSV (최근 30일)
            </a>
          </Button>
        </div>
      </div>

      <DailyTable date={date} rows={studentsWithData} />
    </div>
  );
}
