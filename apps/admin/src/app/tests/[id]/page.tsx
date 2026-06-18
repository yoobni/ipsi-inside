import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { PASSAGE_SOURCE_LABEL, type PassageSource } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TestDetailClient, type AssignedRow, type AvailableStudent } from "./test-detail-client";

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
    .select(
      "id, title, description, target_school, target_grade, open_at, due_at, allow_retake, max_attempts, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!sheet) notFound();

  // 시험지 문항
  const { data: tsq } = await supabase
    .from("test_sheet_questions")
    .select("position, question_id")
    .eq("test_sheet_id", id)
    .order("position");

  const questionIds = (tsq ?? []).map((r) => r.question_id);

  const { data: questions } =
    questionIds.length > 0
      ? await supabase
          .from("questions")
          .select(
            "id, passage_id, position_in_passage, stem, correct_answer, points, difficulty",
          )
          .in("id", questionIds)
      : { data: [] };

  const passageIds = Array.from(
    new Set((questions ?? []).map((q) => q.passage_id)),
  );
  const { data: passages } =
    passageIds.length > 0
      ? await supabase
          .from("passages")
          .select("id, title, source_type, unit_major")
          .in("id", passageIds)
      : { data: [] };

  const passageMap = new Map(
    (passages ?? []).map((p) => [p.id, p] as const),
  );

  // 시험지 내 순서대로 정렬
  const orderedQuestions = (tsq ?? []).map((r) => {
    const q = (questions ?? []).find((qq) => qq.id === r.question_id);
    return { position: r.position, q };
  });

  const totalPoints = orderedQuestions.reduce(
    (s, r) => s + (r.q?.points ?? 0),
    0,
  );

  // 배정 학생
  const { data: assignments } = await supabase
    .from("test_assignments")
    .select("id, student_id, assigned_at, assigned_by_school")
    .eq("test_sheet_id", id);

  const studentIds = (assignments ?? []).map((a) => a.student_id);
  const { data: studentProfiles } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, phone, school, grade")
          .in("id", studentIds)
      : { data: [] };

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: attempts } =
    assignmentIds.length > 0
      ? await supabase
          .from("test_attempts")
          .select("assignment_id, attempt_no, status, score, total_points, submitted_at")
          .in("assignment_id", assignmentIds)
          .order("attempt_no", { ascending: false })
      : { data: [] };

  // 학생별 최신 attempt
  const latestAttemptByAssignment = new Map<
    string,
    NonNullable<typeof attempts>[number]
  >();
  (attempts ?? []).forEach((a) => {
    if (!latestAttemptByAssignment.has(a.assignment_id)) {
      latestAttemptByAssignment.set(a.assignment_id, a);
    }
  });

  const profileMap = new Map(
    (studentProfiles ?? []).map((p) => [p.id, p] as const),
  );

  const assignedRows: AssignedRow[] = (assignments ?? []).map((a) => {
    const p = profileMap.get(a.student_id);
    const latest = latestAttemptByAssignment.get(a.id);
    return {
      assignment_id: a.id,
      student_id: a.student_id,
      full_name: p?.full_name ?? "(unknown)",
      school: p?.school ?? null,
      grade: p?.grade ?? null,
      assigned_at: a.assigned_at,
      assigned_by_school: a.assigned_by_school,
      latest_status: latest?.status ?? null,
      latest_score: latest?.score ?? null,
      latest_total_points: latest?.total_points ?? null,
      latest_attempt_no: latest?.attempt_no ?? null,
      latest_submitted_at: latest?.submitted_at ?? null,
    };
  });

  // 배정 가능한 학생 (승인된 학생 - 이미 배정된 학생 제외)
  const { data: allStudents } = await supabase
    .from("profiles")
    .select("id, full_name, phone, school, grade")
    .eq("role", "student")
    .eq("status", "approved")
    .order("full_name");

  const alreadyAssigned = new Set(studentIds);
  const availableStudents: AvailableStudent[] = (allStudents ?? [])
    .filter((s) => !alreadyAssigned.has(s.id))
    .map((s) => ({
      id: s.id,
      full_name: s.full_name,
      phone: s.phone,
      school: s.school,
      grade: s.grade,
    }));

  const distinctSchools = Array.from(
    new Set(
      (allStudents ?? [])
        .map((s) => s.school)
        .filter((v): v is string => !!v),
    ),
  ).sort();

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
          {sheet.description && (
            <p className="text-muted-foreground text-sm">{sheet.description}</p>
          )}
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {sheet.target_school && (
              <span>
                {sheet.target_school}
                {sheet.target_grade ? ` · ${sheet.target_grade}학년` : ""}
              </span>
            )}
            <Badge variant="outline">{orderedQuestions.length}문항</Badge>
            <Badge variant="outline">총 {totalPoints}점</Badge>
            <Badge variant={sheet.allow_retake ? "primary" : "outline"}>
              {sheet.allow_retake
                ? sheet.max_attempts
                  ? `재응시 ${sheet.max_attempts}회`
                  : "재응시 무제한"
                : "1회만"}
            </Badge>
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

      {/* 일정 */}
      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">일정</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs">오픈</p>
            <p className="mt-0.5 tabular-nums">
              {sheet.open_at ? formatDt(sheet.open_at) : "즉시"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">마감</p>
            <p className="mt-0.5 tabular-nums">
              {sheet.due_at ? formatDt(sheet.due_at) : "무기한"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">생성</p>
            <p className="mt-0.5 tabular-nums">{formatDt(sheet.created_at)}</p>
          </div>
        </div>
      </section>

      {/* 문항 요약 */}
      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">문항 요약</h2>
        </div>
        <div className="p-4">
          {orderedQuestions.length === 0 ? (
            <p className="text-muted-foreground text-sm">문항이 없어요.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 md:grid-cols-4">
              {orderedQuestions.map(({ position, q }) => {
                if (!q) return null;
                const p = passageMap.get(q.passage_id);
                return (
                  <div key={q.id} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-8 shrink-0 tabular-nums">
                      {position}.
                    </span>
                    <span className="font-semibold">
                      {["", "①", "②", "③", "④", "⑤"][q.correct_answer]}
                    </span>
                    <span className="text-muted-foreground truncate">
                      {p?.title}
                      <span className="text-foreground/70 ml-1">
                        #{q.position_in_passage}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 배정 */}
      <TestDetailClient
        testSheetId={id}
        assigned={assignedRows}
        availableStudents={availableStudents}
        distinctSchools={distinctSchools}
      />
    </div>
  );
}

function formatDt(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
