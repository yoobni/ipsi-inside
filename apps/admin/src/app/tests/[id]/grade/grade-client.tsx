"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { saveStudentAnswersAction } from "../../actions";

type Question = {
  question_no: number;
  correct_answer: number;
  unit_major: string;
  unit_minor: string | null;
  points: number;
};

type Student = {
  id: string;
  full_name: string;
  school: string | null;
  grade: number | null;
  status: string;
};

type Existing = { question_no: number; selected: number | null };

export function GradeClient({
  testSheetId,
  questions,
  students,
  targetStudentId,
  existingAnswers,
}: {
  testSheetId: string;
  questions: Question[];
  students: Student[];
  targetStudentId: string;
  existingAnswers: Existing[];
}) {
  const router = useRouter();
  const [studentId, setStudentId] = useState(targetStudentId);

  // 학생 변경 시 페이지 reload로 기존 답안 다시 불러옴
  const switchStudent = (sid: string) => {
    router.push(`/tests/${testSheetId}/grade?studentId=${sid}`);
  };

  return (
    <div className="space-y-6">
      <StudentPicker
        students={students}
        value={studentId}
        onChange={(v) => {
          setStudentId(v);
          switchStudent(v);
        }}
      />

      <GradeForm
        key={studentId}
        testSheetId={testSheetId}
        studentId={studentId}
        questions={questions}
        existingAnswers={existingAnswers}
        students={students}
        onComplete={(nextSid) => {
          if (nextSid) {
            setStudentId(nextSid);
            switchStudent(nextSid);
          } else {
            router.push(`/tests/${testSheetId}`);
          }
        }}
      />
    </div>
  );
}

function StudentPicker({
  students,
  value,
  onChange,
}: {
  students: Student[];
  value: string;
  onChange: (sid: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-4 py-3">
      <span className="text-muted-foreground text-sm">학생</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[280px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {students.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.full_name}
              {s.school ? ` · ${s.school}` : ""}
              {s.grade ? ` ${s.grade}학년` : ""}
              {s.status === "graded" ? " (채점됨)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground ml-auto text-xs">
        ↓ 키보드로 번호 입력 후 Enter 또는 [저장]
      </span>
    </div>
  );
}

function GradeForm({
  testSheetId,
  studentId,
  questions,
  existingAnswers,
  students,
  onComplete,
}: {
  testSheetId: string;
  studentId: string;
  questions: Question[];
  existingAnswers: Existing[];
  students: Student[];
  onComplete: (nextSid: string | null) => void;
}) {
  const existingMap = useMemo(() => {
    const m = new Map<number, number | null>();
    existingAnswers.forEach((a) => m.set(a.question_no, a.selected));
    return m;
  }, [existingAnswers]);

  const [answers, setAnswers] = useState<Record<number, number | null>>(() => {
    const initial: Record<number, number | null> = {};
    questions.forEach((q) => {
      initial[q.question_no] = existingMap.get(q.question_no) ?? null;
    });
    return initial;
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setAnswer = (qNo: number, value: number | null) => {
    setAnswers((prev) => ({ ...prev, [qNo]: value }));
  };

  // 입력 후 다음 칸으로 포커스
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
  ) => {
    if (e.key === "Enter" || e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      refs.current[idx + 1]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      refs.current[idx - 1]?.focus();
    }
  };

  const handleInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    qNo: number,
    idx: number,
  ) => {
    const v = e.target.value.replace(/[^1-5]/g, "").slice(-1);
    if (!v) {
      setAnswer(qNo, null);
      return;
    }
    setAnswer(qNo, Number(v));
    // 즉시 다음 칸으로 이동
    requestAnimationFrame(() => refs.current[idx + 1]?.focus());
  };

  const stats = useMemo(() => {
    let answered = 0;
    let correct = 0;
    let earned = 0;
    let total = 0;
    questions.forEach((q) => {
      total += q.points;
      const sel = answers[q.question_no];
      if (sel !== null && sel !== undefined) {
        answered++;
        if (sel === q.correct_answer) {
          correct++;
          earned += q.points;
        }
      }
    });
    return { answered, correct, earned, total, totalQ: questions.length };
  }, [answers, questions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      testSheetId,
      studentId,
      answers: questions.map((q) => ({
        question_no: q.question_no,
        selected: answers[q.question_no] ?? null,
      })),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));

    startTransition(async () => {
      const r = await saveStudentAnswersAction(null, fd);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // 다음 미채점 학생으로 이동
      const next = students.find(
        (s) => s.id !== studentId && s.status !== "graded",
      );
      onComplete(next?.id ?? null);
    });
  };

  const currentStudent = students.find((s) => s.id === studentId);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 진행 통계 */}
      <div className="grid grid-cols-2 gap-3 rounded-md border bg-card p-4 sm:grid-cols-4">
        <Stat label="응답" value={`${stats.answered} / ${stats.totalQ}`} />
        <Stat label="정답" value={`${stats.correct} / ${stats.totalQ}`} />
        <Stat label="획득" value={`${stats.earned} / ${stats.total}점`} />
        <Stat
          label="정답률"
          value={`${stats.totalQ > 0 ? Math.round((stats.correct / stats.totalQ) * 100) : 0}%`}
        />
      </div>

      {/* 답안 그리드 */}
      <div className="rounded-md border bg-card p-4">
        <p className="text-muted-foreground mb-3 text-xs">
          {currentStudent?.full_name} · 1~5 숫자만 입력하면 자동으로 다음 칸으로
        </p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
          {questions.map((q, idx) => {
            const sel = answers[q.question_no];
            const isCorrect = sel != null && sel === q.correct_answer;
            const isWrong = sel != null && sel !== q.correct_answer;
            return (
              <div key={q.question_no} className="flex flex-col items-center gap-1">
                <span className="text-muted-foreground text-xs tabular-nums">
                  {q.question_no}
                </span>
                <input
                  ref={(el) => {
                    refs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={sel ?? ""}
                  onChange={(e) => handleInput(e, q.question_no, idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  className={cn(
                    "h-12 w-full rounded-md border text-center text-lg font-bold tabular-nums outline-none transition-colors",
                    "focus:border-primary focus:ring-2 focus:ring-primary/20",
                    sel == null && "border-input bg-background",
                    isCorrect &&
                      "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                    isWrong &&
                      "border-destructive bg-destructive/10 text-destructive",
                  )}
                  aria-label={`${q.question_no}번 답`}
                />
                <span className="text-muted-foreground h-3 text-[10px]">
                  {sel != null
                    ? isCorrect
                      ? "✓"
                      : `정답 ${q.correct_answer}`
                    : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const reset: Record<number, number | null> = {};
            questions.forEach((q) => (reset[q.question_no] = null));
            setAnswers(reset);
          }}
        >
          전체 초기화
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "저장 (다음 학생으로)"}
        </Button>
      </div>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 text-base font-bold">{value}</p>
    </div>
  );
}
