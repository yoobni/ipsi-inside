"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { upsertDailyAction } from "./actions";

type Student = {
  id: string;
  full_name: string;
  school: string | null;
  grade: number | null;
};
type Attendance = "present" | "late" | "absent" | null;
type HomeworkGrade = "S" | "A" | "B" | "F" | null;
type Record = {
  attendance: Attendance;
  homework_grade: HomeworkGrade;
  test_score: number | null;
  note: string | null;
  updated_at: string;
};
type Row = {
  student: Student;
  record?: Record;
};

export function DailyTable({ date, rows }: { date: string; rows: Row[] }) {
  const router = useRouter();
  const goDate = (d: string) => {
    router.push(`/daily?date=${d}`);
  };

  const shiftDate = (delta: number) => {
    const dt = new Date(`${date}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + delta);
    goDate(dt.toISOString().slice(0, 10));
  };

  const dateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && goDate(e.target.value)}
          className="h-9 w-[150px]"
        />
        <Button variant="outline" size="icon" onClick={() => shiftDate(1)}>
          <ChevronRight className="size-4" />
        </Button>
        <span className="text-muted-foreground ml-2 text-sm">{dateLabel}</span>
      </div>

      <div className="bg-background rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">학생</TableHead>
              <TableHead className="w-[180px]">출석</TableHead>
              <TableHead className="w-[200px]">과제 (S/A/B/F)</TableHead>
              <TableHead className="w-[120px]">테스트 점수</TableHead>
              <TableHead>메모</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  활성 학생이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <StudentDailyRow key={r.student.id} date={date} row={r} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StudentDailyRow({ date, row }: { date: string; row: Row }) {
  const initial = row.record ?? {
    attendance: null,
    homework_grade: null,
    test_score: null,
    note: null,
    updated_at: "",
  };

  const [attendance, setAttendance] = useState<Attendance>(initial.attendance);
  const [homework, setHomework] = useState<HomeworkGrade>(initial.homework_grade);
  const [score, setScore] = useState<string>(
    initial.test_score == null ? "" : String(initial.test_score),
  );
  const [note, setNote] = useState<string>(initial.note ?? "");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string>(initial.updated_at);

  const save = (
    field: "attendance" | "homework_grade" | "test_score" | "note",
    value: unknown,
  ) => {
    startTransition(async () => {
      const r = await upsertDailyAction({
        studentId: row.student.id,
        date,
        [field]: value,
      } as Parameters<typeof upsertDailyAction>[0]);
      if (r.ok) setSavedAt(new Date().toISOString());
    });
  };

  return (
    <TableRow>
      <TableCell className="pl-4">
        <div className="font-medium">{row.student.full_name}</div>
        <div className="text-muted-foreground text-xs">
          {row.student.school ?? ""}
          {row.student.grade ? ` · ${row.student.grade}학년` : ""}
        </div>
      </TableCell>

      {/* 출석 */}
      <TableCell>
        <ToggleGroup
          options={[
            { value: "present", label: "출석", color: "emerald" },
            { value: "late", label: "지각", color: "amber" },
            { value: "absent", label: "결석", color: "red" },
          ]}
          value={attendance}
          onChange={(v) => {
            const next = (v as Attendance) ?? null;
            setAttendance(next);
            save("attendance", next);
          }}
          disabled={pending}
        />
      </TableCell>

      {/* 과제 */}
      <TableCell>
        <ToggleGroup
          options={[
            { value: "S", label: "S", color: "emerald" },
            { value: "A", label: "A", color: "blue" },
            { value: "B", label: "B", color: "amber" },
            { value: "F", label: "F", color: "red" },
          ]}
          value={homework}
          onChange={(v) => {
            const next = (v as HomeworkGrade) ?? null;
            setHomework(next);
            save("homework_grade", next);
          }}
          disabled={pending}
        />
      </TableCell>

      {/* 테스트 점수 */}
      <TableCell>
        <Input
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          onBlur={() => {
            const trimmed = score.trim();
            const next = trimmed === "" ? null : Math.max(0, Math.min(100, Number(trimmed)));
            const initialScoreStr =
              initial.test_score == null ? "" : String(initial.test_score);
            if (String(next ?? "") !== initialScoreStr) {
              save("test_score", next);
            }
          }}
          placeholder="-"
          className="h-9 w-20 tabular-nums"
          disabled={pending}
        />
      </TableCell>

      {/* 메모 */}
      <TableCell>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            const trimmed = note.trim();
            if (trimmed !== (initial.note ?? "")) {
              save("note", trimmed || null);
            }
          }}
          placeholder="(선택)"
          className="h-9"
          disabled={pending}
        />
      </TableCell>
    </TableRow>
  );
}

type ToggleColor = "emerald" | "amber" | "red" | "blue";
type ToggleOption = { value: string; label: string; color: ToggleColor };

function ToggleGroup({
  options,
  value,
  onChange,
  disabled,
}: {
  options: ToggleOption[];
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="bg-muted/40 inline-flex rounded-md border p-0.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            type="button"
            key={opt.value}
            disabled={disabled}
            onClick={() => onChange(active ? null : opt.value)}
            className={cn(
              "h-7 min-w-[34px] rounded px-2 text-xs font-medium transition-colors",
              active
                ? toggleActiveClass(opt.color)
                : "text-muted-foreground hover:bg-background hover:text-foreground",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function toggleActiveClass(color: ToggleColor): string {
  switch (color) {
    case "emerald":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
    case "amber":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";
    case "red":
      return "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300";
    case "blue":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300";
  }
}
