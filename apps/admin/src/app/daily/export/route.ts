import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? defaultFrom();
  const to = url.searchParams.get("to") ?? defaultTo();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return new NextResponse("Bad date range", { status: 400 });
  }

  const { data: records } = await supabase
    .from("daily_attendance")
    .select(
      "date, student_id, attendance, homework_grade, test_score, note",
    )
    .gte("date", from)
    .lte("date", to)
    .order("date");

  const studentIds = Array.from(
    new Set((records ?? []).map((r) => r.student_id)),
  );
  const { data: students } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, school, grade")
          .in("id", studentIds)
      : { data: [] };
  const profMap = new Map(
    (students ?? []).map((s) => [s.id, s] as const),
  );

  const rows: (string | number | null)[][] = (records ?? []).map((r) => {
    const p = profMap.get(r.student_id);
    return [
      r.date,
      p?.full_name ?? "",
      p?.school ?? "",
      p?.grade ?? null,
      attendanceLabel(r.attendance),
      r.homework_grade ?? "",
      r.test_score ?? null,
      r.note ?? "",
    ];
  });

  const csv = toCsv(
    ["날짜", "이름", "학교", "학년", "출결", "과제", "테스트", "메모"],
    rows,
  );

  return csvResponse(`일일마킹_${from}_${to}.csv`, csv);
}

function attendanceLabel(a: string | null): string {
  if (a === "present") return "출석";
  if (a === "late") return "지각";
  if (a === "absent") return "결석";
  return "";
}

function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}
function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}
