import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { data: prof } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "admin" || prof?.status !== "approved")
    return new NextResponse("Forbidden", { status: 403 });

  const { data: sheet } = await supabase
    .from("test_sheets")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  if (!sheet) return new NextResponse("Not Found", { status: 404 });

  const { data: asgs } = await supabase
    .from("test_assignments")
    .select("id, student_id, assigned_at, assigned_by_school")
    .eq("test_sheet_id", id);

  const studentIds = (asgs ?? []).map((a) => a.student_id);
  const { data: students } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, phone, school, grade")
          .in("id", studentIds)
      : { data: [] };
  const profMap = new Map(
    (students ?? []).map((s) => [s.id, s] as const),
  );

  const asgIds = (asgs ?? []).map((a) => a.id);
  const { data: attempts } =
    asgIds.length > 0
      ? await supabase
          .from("test_attempts")
          .select(
            "id, assignment_id, attempt_no, status, score, total_points, submitted_at, started_at",
          )
          .in("assignment_id", asgIds)
          .order("attempt_no", { ascending: false })
      : { data: [] };

  // 학생별 최신 attempt만
  const latestByAsg = new Map<string, NonNullable<typeof attempts>[number]>();
  (attempts ?? []).forEach((a) => {
    if (!latestByAsg.has(a.assignment_id)) latestByAsg.set(a.assignment_id, a);
  });

  const rows: (string | number | null)[][] = (asgs ?? []).map((a) => {
    const p = profMap.get(a.student_id);
    const t = latestByAsg.get(a.id);
    const percent =
      t?.score != null && t.total_points && t.total_points > 0
        ? Math.round((t.score / t.total_points) * 100)
        : null;
    return [
      p?.full_name ?? "",
      p?.school ?? "",
      p?.grade ?? null,
      p?.phone ?? "",
      a.assigned_by_school ?? "",
      t?.status === "submitted" ? "제출" : t?.status === "in_progress" ? "응시중" : "대기",
      t?.attempt_no ?? null,
      t?.score ?? null,
      t?.total_points ?? null,
      percent != null ? `${percent}%` : "",
      t?.submitted_at ?? "",
    ];
  });

  const csv = toCsv(
    [
      "이름",
      "학교",
      "학년",
      "전화",
      "학교배정",
      "상태",
      "회차",
      "점수",
      "만점",
      "정답률",
      "제출시각",
    ],
    rows,
  );

  return csvResponse(
    `${sheet.title}_응시결과_${dateStamp()}.csv`,
    csv,
  );
}

function dateStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
