import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { GradeClient } from "./grade-client";

export const dynamic = "force-dynamic";

export default async function GradePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { id } = await params;
  const { studentId: requestedStudentId } = await searchParams;

  const supabase = await createServerSupabaseClient();

  const { data: sheet } = await supabase
    .from("test_sheets")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();
  if (!sheet) notFound();

  const { data: questions } = await supabase
    .from("test_questions")
    .select("question_no, correct_answer, unit_major, unit_minor, points")
    .eq("test_sheet_id", id)
    .order("question_no");

  // 배정된 학생들 + 채점 상태
  const { data: assignments } = await supabase
    .from("test_assignments")
    .select("student_id, status")
    .eq("test_sheet_id", id);
  const assignedIds = (assignments ?? []).map((a) => a.student_id);

  if (assignedIds.length === 0) {
    // 배정된 학생 없으면 상세로 돌려보냄
    redirect(`/tests/${id}`);
  }

  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, school, grade")
    .in("id", assignedIds)
    .order("full_name");

  const studentList = (students ?? []).map((s) => {
    const a = (assignments ?? []).find((x) => x.student_id === s.id);
    return { ...s, status: a?.status ?? "assigned" };
  });

  // 기본 대상 학생: 쿼리 파라미터 우선, 없으면 첫 미채점 학생, 모두 채점됐으면 첫 학생
  const targetStudentId =
    requestedStudentId && assignedIds.includes(requestedStudentId)
      ? requestedStudentId
      : (studentList.find((s) => s.status !== "graded")?.id ??
        studentList[0]?.id);

  if (!targetStudentId) redirect(`/tests/${id}`);

  // 해당 학생의 기존 답안
  const { data: existingAnswers } = await supabase
    .from("student_answers")
    .select("question_no, selected")
    .eq("test_sheet_id", id)
    .eq("student_id", targetStudentId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/tests/${id}`}>
            <ChevronLeft className="size-4" />
            시험지로 돌아가기
          </Link>
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">답안 마킹</h1>
        <p className="text-muted-foreground text-sm">{sheet.title}</p>
      </div>

      <GradeClient
        testSheetId={id}
        questions={(questions ?? []).map((q) => ({
          question_no: q.question_no,
          correct_answer: q.correct_answer,
          unit_major: q.unit_major,
          unit_minor: q.unit_minor,
          points: q.points,
        }))}
        students={studentList}
        targetStudentId={targetStudentId}
        existingAnswers={(existingAnswers ?? []).map((a) => ({
          question_no: a.question_no,
          selected: a.selected,
        }))}
      />
    </div>
  );
}
