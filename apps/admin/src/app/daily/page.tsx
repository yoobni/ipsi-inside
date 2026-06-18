import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { todayKst } from "@/lib/kst";
import { DailyTable } from "./daily-table";

export const dynamic = "force-dynamic";

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayKst();

  const supabase = await createServerSupabaseClient();

  // 활성 학생 전체
  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, school, grade")
    .eq("role", "student")
    .eq("status", "approved")
    .order("full_name");

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">일일 마킹</h1>
        <p className="text-muted-foreground text-sm">
          학생별 출석/과제/테스트 점수를 빠르게 기록해요. 변경하면 즉시 저장돼요.
        </p>
      </div>

      <DailyTable date={date} rows={studentsWithData} />
    </div>
  );
}
