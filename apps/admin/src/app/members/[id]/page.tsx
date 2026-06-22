import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, NotebookPen, CalendarCheck } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { todayKst } from "@/lib/kst";
import { MemberReport, type ReportData } from "./member-report";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: member } = await supabase
    .from("profiles")
    .select("id, role, status, full_name, phone, school, grade, created_at, approved_at")
    .eq("id", id)
    .maybeSingle();
  if (!member) notFound();

  // 학생만 종합 리포트. 학부모/admin은 회원 목록으로 돌려보냄
  if (member.role !== "student") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/members">
              <ChevronLeft className="size-4" />
              목록
            </Link>
          </Button>
        </div>
        <div className="rounded-md border bg-card p-6">
          <h1 className="text-xl font-bold">{member.full_name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {member.role === "parent" ? "학부모" : "관리자"} 계정 — 종합 리포트는 학생 전용입니다.
          </p>
          <p className="text-muted-foreground mt-3 text-sm">
            {member.phone}
          </p>
        </div>
      </div>
    );
  }

  // 연결된 학부모
  const { data: parentLinks } = await supabase
    .from("parent_student_links")
    .select("parent_id, profiles!parent_student_links_parent_id_fkey(full_name, phone)")
    .eq("student_id", id);
  const parents = (parentLinks ?? []).map((l) => {
    const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
    return { id: l.parent_id, full_name: p?.full_name ?? "", phone: p?.phone ?? "" };
  });

  // 최근 30일 출결
  const today = todayKst();
  const todayDt = new Date(`${today}T00:00:00Z`);
  const since = new Date(todayDt);
  since.setUTCDate(since.getUTCDate() - 29);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data: attendance } = await supabase
    .from("daily_attendance")
    .select("date, attendance, homework_grade, test_score, note")
    .eq("student_id", id)
    .gte("date", sinceDate)
    .lte("date", today)
    .order("date");

  // 일지 (최근 14일)
  const since14 = new Date(todayDt);
  since14.setUTCDate(since14.getUTCDate() - 13);
  const since14Date = since14.toISOString().slice(0, 10);

  const { data: journals } = await supabase
    .from("study_journals")
    .select(
      "journal_date, class_question, test_question, message_to_teacher, learning_log, content",
    )
    .eq("student_id", id)
    .gte("journal_date", since14Date)
    .lte("journal_date", today);

  // 시험 — 응시 기록
  const { data: assignments } = await supabase
    .from("test_assignments")
    .select(
      "id, assigned_at, test_sheets(id, title, due_at, target_grade)",
    )
    .eq("student_id", id)
    .order("assigned_at", { ascending: false });

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

  // 단원별 누적 정답률 — 학생의 모든 submitted attempt를 합쳐서
  const submittedAttemptIds = (attempts ?? [])
    .filter((a) => a.status === "submitted")
    .map((a) => a.id);

  const unitAccumulator = new Map<
    string,
    { unit_major: string; total: number; correct: number }
  >();

  if (submittedAttemptIds.length > 0) {
    // 각 attempt의 unit stats를 합산 (RPC 사용)
    for (const aid of submittedAttemptIds) {
      const { data: stats } = await supabase.rpc("attempt_unit_stats", {
        p_attempt_id: aid,
      });
      (stats ?? []).forEach((u) => {
        const key = u.unit_major;
        const cur = unitAccumulator.get(key) ?? {
          unit_major: u.unit_major,
          total: 0,
          correct: 0,
        };
        cur.total += u.total;
        cur.correct += u.correct;
        unitAccumulator.set(key, cur);
      });
    }
  }

  const unitStats = Array.from(unitAccumulator.values())
    .map((u) => ({
      ...u,
      accuracy: u.total > 0 ? Math.round((u.correct / u.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // 시험 응시 row 구성
  const examRows = (assignments ?? []).map((a) => {
    const sheet = Array.isArray(a.test_sheets) ? a.test_sheets[0] : a.test_sheets;
    const mine = (attempts ?? []).filter((t) => t.assignment_id === a.id);
    const submitted = mine.filter((t) => t.status === "submitted");
    const latest = submitted[0] ?? null;
    return {
      assignment_id: a.id,
      test_sheet_id: sheet?.id ?? "",
      title: sheet?.title ?? "",
      due_at: sheet?.due_at ?? null,
      attempts_submitted: submitted.length,
      latest_attempt_id: latest?.id ?? null,
      latest_score: latest?.score ?? null,
      latest_total: latest?.total_points ?? null,
      latest_submitted_at: latest?.submitted_at ?? null,
    };
  });

  // 통계 요약 카드
  const att = attendance ?? [];
  const present = att.filter((a) => a.attendance === "present").length;
  const late = att.filter((a) => a.attendance === "late").length;
  const absent = att.filter((a) => a.attendance === "absent").length;
  const attendanceCount = present + late + absent;
  const attendanceRate =
    attendanceCount > 0
      ? Math.round(((present + late * 0.5) / attendanceCount) * 100)
      : null;

  const homeworkScores = att
    .map((a) => homeworkToScore(a.homework_grade))
    .filter((v): v is number => v !== null);
  const homeworkAvg =
    homeworkScores.length > 0
      ? Math.round(
          (homeworkScores.reduce((a, b) => a + b, 0) / homeworkScores.length) *
            10,
        ) / 10
      : null;

  const testScores = att
    .map((a) => a.test_score)
    .filter((v): v is number => v !== null);
  const testAvg =
    testScores.length > 0
      ? Math.round(
          (testScores.reduce((a, b) => a + b, 0) / testScores.length) * 10,
        ) / 10
      : null;

  const journalDates = new Set((journals ?? []).map((j) => j.journal_date));
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(todayDt);
    d.setUTCDate(d.getUTCDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const journalRate = Math.round(
    (last14.filter((d) => journalDates.has(d)).length / 14) * 100,
  );

  const data: ReportData = {
    member: {
      id: member.id,
      full_name: member.full_name,
      phone: member.phone,
      school: member.school,
      grade: member.grade,
      created_at: member.created_at,
      approved_at: member.approved_at,
      status: member.status,
    },
    parents,
    summary: {
      attendanceRate,
      attendanceCount,
      present,
      late,
      absent,
      homeworkAvg,
      homeworkCount: homeworkScores.length,
      testAvgPaperTest: testAvg,
      testPaperCount: testScores.length,
      journalRate,
      journalCount: journalDates.size,
      examSubmitted: examRows.filter((r) => r.attempts_submitted > 0).length,
      examAssigned: examRows.length,
    },
    attendance: att.map((a) => ({
      date: a.date,
      attendance: a.attendance,
      homework_grade: a.homework_grade,
      test_score: a.test_score,
      note: a.note,
    })),
    last14Days: last14.map((d) => ({
      date: d,
      hasJournal: journalDates.has(d),
    })),
    journals: (journals ?? []).map((j) => ({
      journal_date: j.journal_date,
      class_question: j.class_question,
      test_question: j.test_question,
      message_to_teacher: j.message_to_teacher,
      learning_log: j.learning_log,
      content: j.content,
    })),
    exams: examRows,
    unitStats,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/members">
            <ChevronLeft className="size-4" />
            회원 목록
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {data.member.full_name}
            </h1>
            <Badge variant={data.member.status === "approved" ? "success" : "warning"}>
              {data.member.status === "approved"
                ? "활성"
                : data.member.status === "suspended"
                  ? "정지"
                  : data.member.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {data.member.school ?? "-"}
            {data.member.grade ? ` · ${data.member.grade}학년` : ""}
            <span className="mx-2">·</span>
            {data.member.phone}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:flex sm:flex-row">
          <SummaryPill
            icon={<CalendarCheck className="size-3" />}
            label="출석률"
            value={
              data.summary.attendanceRate != null
                ? `${data.summary.attendanceRate}%`
                : "—"
            }
          />
          <SummaryPill
            icon={<FileText className="size-3" />}
            label="시험"
            value={`${data.summary.examSubmitted}/${data.summary.examAssigned}`}
          />
          <SummaryPill
            icon={<NotebookPen className="size-3" />}
            label="일지"
            value={`${data.summary.journalCount}일`}
          />
        </div>
      </div>

      <MemberReport data={data} />
    </div>
  );
}

function SummaryPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-muted-foreground inline-flex items-center gap-1 text-[10px] font-medium">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

function homeworkToScore(g: string | null): number | null {
  if (g === "S") return 4;
  if (g === "A") return 3;
  if (g === "B") return 2;
  if (g === "F") return 0;
  return null;
}
