import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { todayKst } from "@/lib/kst";
import { GroupFilter } from "../group-filter";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 14;

const ATT_LABEL: Record<string, string> = {
  present: "출",
  late: "지",
  absent: "결",
};
const ATT_CLASS: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  late: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  absent: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

function dateWindow(toDate: string): string[] {
  const out: string[] = [];
  const base = new Date(`${toDate}T00:00:00Z`);
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function mmdd(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
}

export default async function DailyBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : todayKst();
  const groupId = sp.group ?? null;
  const dates = dateWindow(to);
  const from = dates[0];

  const supabase = await createServerSupabaseClient();

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
  const studentIds = (students ?? []).map((s) => s.id);

  const { data: rows } =
    studentIds.length > 0
      ? await supabase
          .from("daily_attendance")
          .select("student_id, date, attendance, homework_grade, test_score")
          .gte("date", from)
          .lte("date", to)
          .in("student_id", studentIds)
      : { data: [] };

  // (student_id|date) → record
  const byKey = new Map(
    (rows ?? []).map((r) => [`${r.student_id}|${r.date}`, r] as const),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/daily${groupId ? `?group=${groupId}` : ""}`}>
            <ChevronLeft className="size-4" />
            마킹으로
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">한눈에 보기</h1>
          <p className="text-muted-foreground text-sm">
            최근 {WINDOW_DAYS}일 출결/과제/점수를 학생 × 날짜로 모아 봐요. 날짜를
            누르면 그날 마킹 화면으로 가요.
          </p>
        </div>
        <GroupFilter groups={groups ?? []} value={groupId} />
      </div>

      {studentIds.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-12 text-center text-sm">
          {groupId
            ? "이 그룹에 학생이 없어요."
            : "활성 학생이 없어요."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="bg-card sticky left-0 z-10 px-3 py-2 text-left font-semibold">
                  학생
                </th>
                {dates.map((d) => (
                  <th
                    key={d}
                    className="px-2 py-2 text-center font-medium whitespace-nowrap"
                  >
                    <Link
                      href={`/daily?date=${d}${groupId ? `&group=${groupId}` : ""}`}
                      className="text-muted-foreground hover:text-foreground tabular-nums"
                    >
                      {mmdd(d)}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(students ?? []).map((s) => (
                <tr key={s.id} className="border-b last:border-b-0">
                  <td className="bg-card sticky left-0 z-10 px-3 py-2">
                    <div className="font-medium whitespace-nowrap">
                      {s.full_name}
                    </div>
                    {(s.school || s.grade) && (
                      <div className="text-muted-foreground text-xs whitespace-nowrap">
                        {s.school ?? ""}
                        {s.grade ? ` ${s.grade}학년` : ""}
                      </div>
                    )}
                  </td>
                  {dates.map((d) => {
                    const r = byKey.get(`${s.id}|${d}`);
                    const hasAny =
                      r &&
                      (r.attendance ||
                        r.homework_grade ||
                        r.test_score != null);
                    return (
                      <td key={d} className="px-1.5 py-1.5 text-center align-top">
                        {!hasAny ? (
                          <span className="text-muted-foreground/40">·</span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            {r?.attendance && (
                              <span
                                className={`inline-flex size-5 items-center justify-center rounded text-[11px] font-bold ${ATT_CLASS[r.attendance] ?? ""}`}
                              >
                                {ATT_LABEL[r.attendance] ?? ""}
                              </span>
                            )}
                            {(r?.homework_grade || r?.test_score != null) && (
                              <span className="text-muted-foreground text-[10px] whitespace-nowrap tabular-nums">
                                {r?.homework_grade ?? ""}
                                {r?.homework_grade && r?.test_score != null
                                  ? "·"
                                  : ""}
                                {r?.test_score != null ? r.test_score : ""}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
        <span>
          <span className="mr-1 inline-flex size-4 items-center justify-center rounded bg-emerald-50 text-[10px] font-bold text-emerald-700">
            출
          </span>
          출석
        </span>
        <span>
          <span className="mr-1 inline-flex size-4 items-center justify-center rounded bg-amber-50 text-[10px] font-bold text-amber-700">
            지
          </span>
          지각
        </span>
        <span>
          <span className="mr-1 inline-flex size-4 items-center justify-center rounded bg-red-50 text-[10px] font-bold text-red-700">
            결
          </span>
          결석
        </span>
        <span>과제 S/A/B/F · 점수</span>
      </div>
    </div>
  );
}
