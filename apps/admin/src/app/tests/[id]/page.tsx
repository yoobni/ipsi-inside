import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, Pencil, UserPlus } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TestDetailClient } from "./test-detail-client";

export const dynamic = "force-dynamic";

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: sheet } = await supabase
    .from("test_sheets")
    .select("id, title, target_school, target_grade, test_date, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!sheet) notFound();

  const { data: questions } = await supabase
    .from("test_questions")
    .select("question_no, correct_answer, unit_major, unit_minor, difficulty, points")
    .eq("test_sheet_id", id)
    .order("question_no");

  const { data: assignments } = await supabase
    .from("test_assignments")
    .select("student_id, status, assigned_at")
    .eq("test_sheet_id", id);

  const assignedIds = (assignments ?? []).map((a) => a.student_id);

  const { data: assignedStudents } =
    assignedIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, phone, school, grade")
          .in("id", assignedIds)
      : { data: [] };

  // 배정 가능한 학생 (승인된 학생 전체에서 이미 배정된 거 제외)
  const { data: allApprovedStudents } = await supabase
    .from("profiles")
    .select("id, full_name, phone, school, grade")
    .eq("role", "student")
    .eq("status", "approved")
    .order("full_name");

  const availableStudents = (allApprovedStudents ?? []).filter(
    (s) => !assignedIds.includes(s.id),
  );

  const totalPoints = (questions ?? []).reduce((sum, q) => sum + q.points, 0);
  const gradedCount = (assignments ?? []).filter((a) => a.status === "graded").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tests">
            <ChevronLeft className="size-4" />
            목록
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{sheet.title}</h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {sheet.target_school && (
              <span>
                {sheet.target_school}
                {sheet.target_grade ? ` · ${sheet.target_grade}학년` : ""}
              </span>
            )}
            {sheet.test_date && <span>시험일 {sheet.test_date}</span>}
            <Badge variant="outline">{questions?.length ?? 0}문항</Badge>
            <Badge variant="outline">총 {totalPoints}점</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/tests/${id}/edit`}>
              <Pencil className="size-4" /> 편집
            </Link>
          </Button>
        </div>
      </div>

      {/* 문항 요약 */}
      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4" /> 문항 요약
          </h2>
        </div>
        <div className="p-4">
          {questions && questions.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 md:grid-cols-5">
              {questions.map((q) => (
                <div
                  key={q.question_no}
                  className="flex items-center gap-2"
                >
                  <span className="text-muted-foreground w-8 shrink-0 tabular-nums">
                    {q.question_no}.
                  </span>
                  <span className="font-medium">
                    {["", "①", "②", "③", "④", "⑤"][q.correct_answer]}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {q.unit_major}
                    {q.unit_minor ? ` · ${q.unit_minor}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">문항이 없어요.</p>
          )}
        </div>
      </section>

      {/* 학생 배정/채점 */}
      <TestDetailClient
        testSheetId={id}
        assignedStudents={(assignedStudents ?? []).map((s) => {
          const assn = (assignments ?? []).find((a) => a.student_id === s.id);
          return {
            ...s,
            status: assn?.status ?? "assigned",
            assigned_at: assn?.assigned_at ?? "",
          };
        })}
        availableStudents={availableStudents}
        gradedCount={gradedCount}
      />
    </div>
  );
}
