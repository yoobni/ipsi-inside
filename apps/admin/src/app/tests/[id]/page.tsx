import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, Pencil } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import type { QuestionChoice } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TestPreview, type PreviewQuestion } from "@/components/test-preview";
import { DuplicateButton } from "./duplicate-button";
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
            "id, passage_id, position_in_passage, stem, supplementary, choices, correct_answer, points, difficulty",
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
          .select("id, title, source_type, unit_major, content")
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

  // 미리보기용
  const previewQuestions: PreviewQuestion[] = orderedQuestions
    .map(({ position, q }) => {
      if (!q) return null;
      const p = passageMap.get(q.passage_id);
      return {
        position,
        passage: p
          ? { id: p.id, title: p.title, content: p.content }
          : null,
        position_in_passage: q.position_in_passage,
        stem: q.stem,
        supplementary: q.supplementary,
        choices: q.choices as QuestionChoice[],
        correct_answer: q.correct_answer,
        points: q.points,
      };
    })
    .filter((x): x is PreviewQuestion => x !== null);

  // 문항별 정답률 집계 (제출된 attempt만)
  const submittedAttemptIdsForSheet = await (async () => {
    const { data: asgs } = await supabase
      .from("test_assignments")
      .select("id")
      .eq("test_sheet_id", id);
    const aIds = (asgs ?? []).map((a) => a.id);
    if (aIds.length === 0) return [];
    const { data: ats } = await supabase
      .from("test_attempts")
      .select("id")
      .in("assignment_id", aIds)
      .eq("status", "submitted");
    return (ats ?? []).map((a) => a.id);
  })();

  const perQuestion = new Map<string, { correct: number; total: number }>();
  if (submittedAttemptIdsForSheet.length > 0 && questionIds.length > 0) {
    const { data: answers } = await supabase
      .from("student_answers")
      .select("question_id, is_correct")
      .in("attempt_id", submittedAttemptIdsForSheet)
      .in("question_id", questionIds);
    (answers ?? []).forEach((a) => {
      const cur = perQuestion.get(a.question_id) ?? { correct: 0, total: 0 };
      cur.total += 1;
      if (a.is_correct) cur.correct += 1;
      perQuestion.set(a.question_id, cur);
    });
  }

  const questionStats = orderedQuestions
    .map(({ position, q }) => {
      if (!q) return null;
      const s = perQuestion.get(q.id);
      return {
        position,
        question_id: q.id,
        correct: s?.correct ?? 0,
        total: s?.total ?? 0,
        accuracy: s && s.total > 0 ? Math.round((s.correct / s.total) * 100) : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

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
          .select(
            "id, assignment_id, attempt_no, status, score, total_points, submitted_at",
          )
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
      latest_attempt_id: latest?.id ?? null,
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
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/tests/${id}/export`} download>
              <Download className="size-4" /> CSV
            </a>
          </Button>
          <DuplicateButton testSheetId={id} />
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

      {/* 문항 요약 + 미리보기 */}
      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">시험지 미리보기</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            학생이 보는 모바일 화면 그대로. 정답은 admin에게만 표시돼요.
          </p>
        </div>
        <div className="grid gap-6 p-4 md:grid-cols-[1fr_auto]">
          <div>
            <h3 className="text-foreground text-xs font-semibold">정답 요약</h3>
            {orderedQuestions.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">문항이 없어요.</p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
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
                      <span className="text-muted-foreground truncate text-xs">
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
          {previewQuestions.length > 0 && (
            <TestPreview questions={previewQuestions} />
          )}
        </div>
      </section>

      {/* 문항별 정답률 */}
      {questionStats.some((s) => s.total > 0) && (
        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">문항별 정답률</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              제출된 응시만 집계 — 정답률 낮은 문항이 위로
            </p>
          </div>
          <ul className="divide-y">
            {questionStats
              .slice()
              .sort((a, b) => {
                const A = a.accuracy ?? 101;
                const B = b.accuracy ?? 101;
                return A - B;
              })
              .map((s) => (
                <li
                  key={s.question_id}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="bg-muted text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded text-xs font-bold tabular-nums">
                    {s.position}
                  </span>
                  <div className="bg-muted relative h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className={
                        "h-2 transition-all " +
                        (s.accuracy == null
                          ? ""
                          : s.accuracy >= 70
                            ? "bg-emerald-500"
                            : s.accuracy >= 50
                              ? "bg-amber-500"
                              : "bg-red-500")
                      }
                      style={{
                        width: s.accuracy != null ? `${s.accuracy}%` : "0%",
                      }}
                    />
                  </div>
                  <span className="w-28 text-right tabular-nums">
                    {s.accuracy != null ? `${s.accuracy}%` : "—"}
                    <span className="text-muted-foreground ml-1 text-xs">
                      ({s.correct}/{s.total})
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

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
