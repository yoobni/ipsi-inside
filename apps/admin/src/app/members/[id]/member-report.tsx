"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ReportData = {
  member: {
    id: string;
    full_name: string;
    phone: string;
    school: string | null;
    grade: number | null;
    created_at: string;
    approved_at: string | null;
    status: string;
  };
  parents: { id: string; full_name: string; phone: string }[];
  summary: {
    attendanceRate: number | null;
    attendanceCount: number;
    present: number;
    late: number;
    absent: number;
    homeworkAvg: number | null;
    homeworkCount: number;
    testAvgPaperTest: number | null;
    testPaperCount: number;
    journalRate: number;
    journalCount: number;
    examSubmitted: number;
    examAssigned: number;
  };
  attendance: {
    date: string;
    attendance: "present" | "late" | "absent" | null;
    homework_grade: "S" | "A" | "B" | "F" | null;
    test_score: number | null;
    note: string | null;
  }[];
  last14Days: { date: string; hasJournal: boolean }[];
  journals: {
    journal_date: string;
    class_question: string | null;
    test_question: string | null;
    message_to_teacher: string | null;
    learning_log: string | null;
    content: string | null;
  }[];
  exams: {
    assignment_id: string;
    test_sheet_id: string;
    title: string;
    due_at: string | null;
    attempts_submitted: number;
    latest_attempt_id: string | null;
    latest_score: number | null;
    latest_total: number | null;
    latest_submitted_at: string | null;
  }[];
  unitStats: { unit_major: string; total: number; correct: number; accuracy: number }[];
};

export function MemberReport({ data }: { data: ReportData }) {
  const { summary, attendance, last14Days, journals, exams, unitStats, parents } = data;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 좌측 — 출석 / 과제 / 시험 추세 */}
      <div className="space-y-6 lg:col-span-2">
        {/* 30일 출석 카드 */}
        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">최근 30일 출결·과제</h2>
              <div className="text-muted-foreground text-xs">
                출 {summary.present} · 지 {summary.late} · 결 {summary.absent}
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-10 gap-1 sm:grid-cols-15 md:grid-cols-30">
              {attendance.length === 0 ? (
                <p className="text-muted-foreground col-span-full text-sm">
                  최근 30일간 기록이 없어요.
                </p>
              ) : (
                attendance.map((a) => (
                  <div
                    key={a.date}
                    title={`${a.date} · ${labelAttendance(a.attendance)}${a.homework_grade ? ` / 과제 ${a.homework_grade}` : ""}${a.test_score != null ? ` / 테스트 ${a.test_score}` : ""}`}
                    className={cn(
                      "size-4 rounded-sm",
                      a.attendance === "present" && "bg-emerald-500",
                      a.attendance === "late" && "bg-amber-500",
                      a.attendance === "absent" && "bg-red-500",
                      !a.attendance && "bg-muted",
                    )}
                  />
                ))
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <Metric
                label="출석률"
                value={
                  summary.attendanceRate != null
                    ? `${summary.attendanceRate}%`
                    : "—"
                }
                sub={`${summary.attendanceCount}일 기록`}
              />
              <Metric
                label="과제 평균"
                value={
                  summary.homeworkAvg != null
                    ? scoreToGrade(summary.homeworkAvg)
                    : "—"
                }
                sub={`${summary.homeworkCount}회`}
              />
              <Metric
                label="일일 테스트 평균"
                value={
                  summary.testAvgPaperTest != null
                    ? `${summary.testAvgPaperTest}점`
                    : "—"
                }
                sub={`${summary.testPaperCount}회`}
              />
            </div>
          </div>
        </section>

        {/* 시험 응시 기록 */}
        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">시험 응시 기록</h2>
          </div>
          {exams.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              배정된 시험이 없어요.
            </p>
          ) : (
            <ul className="divide-y">
              {exams.map((e) => (
                <li
                  key={e.assignment_id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      <Link
                        href={`/tests/${e.test_sheet_id}`}
                        className="hover:underline"
                      >
                        {e.title}
                      </Link>
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {e.due_at ? `마감 ${formatDt(e.due_at)} · ` : ""}
                      {e.attempts_submitted > 0
                        ? `${e.attempts_submitted}회 제출`
                        : "미응시"}
                      {e.latest_submitted_at &&
                        ` · 최근 ${formatDt(e.latest_submitted_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    {e.latest_score != null && e.latest_total != null ? (
                      <span className="text-sm font-semibold tabular-nums">
                        {e.latest_score}/{e.latest_total}
                      </span>
                    ) : (
                      <Badge variant="outline">미응시</Badge>
                    )}
                    {e.latest_attempt_id && (
                      <Link
                        href={`/tests/${e.test_sheet_id}/attempts/${e.latest_attempt_id}`}
                        className="text-primary inline-flex items-center text-xs font-bold hover:underline"
                      >
                        상세
                        <ArrowRight className="size-3" />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 단원별 누적 정답률 */}
        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">단원별 누적 정답률</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              제출한 모든 시험을 합산
            </p>
          </div>
          <div className="p-4">
            {unitStats.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                시험 데이터가 누적되면 표시돼요.
              </p>
            ) : (
              <ul className="space-y-2">
                {unitStats.map((u) => (
                  <li
                    key={u.unit_major}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="w-28 shrink-0 truncate font-medium">
                      {u.unit_major}
                    </span>
                    <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          "h-2 transition-all",
                          u.accuracy >= 70
                            ? "bg-emerald-500"
                            : u.accuracy >= 50
                              ? "bg-amber-500"
                              : "bg-red-500",
                        )}
                        style={{ width: `${u.accuracy}%` }}
                      />
                    </div>
                    <span className="w-24 text-right tabular-nums">
                      {u.accuracy}% ({u.correct}/{u.total})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* 우측 — 일지 / 학부모 */}
      <div className="space-y-6">
        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">최근 14일 일지</h2>
              <div className="text-muted-foreground text-xs">
                {summary.journalRate}%
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-1">
              {last14Days.map((d) => (
                <div
                  key={d.date}
                  title={d.date}
                  className={cn(
                    "size-5 rounded-sm",
                    d.hasJournal ? "bg-primary" : "bg-muted",
                  )}
                />
              ))}
            </div>
            {journals.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {journals.slice(0, 5).map((j) => (
                  <li
                    key={j.journal_date}
                    className="border-l-primary/40 border-l-2 pl-2 text-xs"
                  >
                    <p className="text-foreground font-medium tabular-nums">
                      {j.journal_date}
                    </p>
                    <p className="text-muted-foreground line-clamp-2">
                      {summarizeJournal(j)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground mt-4 text-xs">
                최근 일지가 없어요.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">연결 학부모</h2>
          </div>
          <div className="p-4">
            {parents.length === 0 ? (
              <p className="text-muted-foreground text-sm">없음</p>
            ) : (
              <ul className="divide-y">
                {parents.map((p) => (
                  <li key={p.id} className="py-2 first:pt-0 last:pb-0 text-sm">
                    <p className="font-medium">{p.full_name}</p>
                    <p className="text-muted-foreground text-xs">{p.phone}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-muted-foreground text-[10px] font-medium">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
      <p className="text-muted-foreground mt-0.5 text-[10px]">{sub}</p>
    </div>
  );
}

function labelAttendance(a: string | null): string {
  if (a === "present") return "출석";
  if (a === "late") return "지각";
  if (a === "absent") return "결석";
  return "기록 없음";
}

function scoreToGrade(score: number): string {
  if (score >= 3.5) return "S";
  if (score >= 2.5) return "A";
  if (score >= 1.5) return "B";
  return "F";
}

function summarizeJournal(j: {
  class_question: string | null;
  test_question: string | null;
  message_to_teacher: string | null;
  learning_log: string | null;
  content: string | null;
}): string {
  const parts = [
    j.class_question,
    j.test_question,
    j.message_to_teacher,
    j.learning_log,
    j.content,
  ].filter((s): s is string => !!s && s.trim().length > 0);
  return parts.join(" · ");
}

function formatDt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
