"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  UNIT_MAJOR_PRESETS,
  DIFFICULTY,
  type TestSheetWithQuestions,
} from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  question_no: number;
  correct_answer: number | "";
  unit_major: string;
  unit_minor: string;
  difficulty: "상" | "중" | "하" | "";
  points: number;
};

type Props = {
  mode: "create" | "edit";
  defaultValues?: TestSheetWithQuestions;
  onSubmit: (payload: TestSheetWithQuestions) => Promise<{
    ok: true;
  } | { ok: false; message: string }>;
  submitLabel?: string;
};

export function TestSheetForm({
  mode,
  defaultValues,
  onSubmit,
  submitLabel,
}: Props) {
  const initialMeta = defaultValues?.meta ?? {
    title: "",
    targetSchool: null,
    targetGrade: null,
    testDate: null,
  };
  const initialRows: Row[] = defaultValues?.questions?.length
    ? defaultValues.questions.map((q) => ({
        question_no: q.question_no,
        correct_answer: q.correct_answer,
        unit_major: q.unit_major,
        unit_minor: q.unit_minor ?? "",
        difficulty: (q.difficulty as Row["difficulty"]) ?? "",
        points: q.points,
      }))
    : Array.from({ length: 5 }, (_, i) => ({
        question_no: i + 1,
        correct_answer: "" as const,
        unit_major: "",
        unit_minor: "",
        difficulty: "" as const,
        points: 1,
      }));

  const [title, setTitle] = useState(initialMeta.title);
  const [targetSchool, setTargetSchool] = useState(initialMeta.targetSchool ?? "");
  const [targetGrade, setTargetGrade] = useState(
    initialMeta.targetGrade ? String(initialMeta.targetGrade) : "",
  );
  const [testDate, setTestDate] = useState(initialMeta.testDate ?? "");
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        question_no: prev.length > 0 ? Math.max(...prev.map((r) => r.question_no)) + 1 : 1,
        correct_answer: "",
        unit_major: prev.length > 0 ? prev[prev.length - 1]!.unit_major : "",
        unit_minor: "",
        difficulty: "",
        points: 1,
      },
    ]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("시험지 제목을 입력해주세요");
      return;
    }
    if (rows.length === 0) {
      setError("최소 1개 이상의 문항을 입력해주세요");
      return;
    }
    // 유효성 검증
    for (const r of rows) {
      if (!r.correct_answer || r.correct_answer < 1 || r.correct_answer > 5) {
        setError(`문항 ${r.question_no}: 정답(1~5)을 선택해주세요`);
        return;
      }
      if (!r.unit_major.trim()) {
        setError(`문항 ${r.question_no}: 대단원을 입력해주세요`);
        return;
      }
    }
    const nos = rows.map((r) => r.question_no);
    if (new Set(nos).size !== nos.length) {
      setError("문항 번호가 중복됩니다");
      return;
    }

    const payload: TestSheetWithQuestions = {
      meta: {
        title: title.trim(),
        targetSchool: targetSchool.trim() || null,
        targetGrade: targetGrade ? Number(targetGrade) : null,
        testDate: testDate || null,
      },
      questions: rows.map((r) => ({
        question_no: r.question_no,
        correct_answer: Number(r.correct_answer),
        unit_major: r.unit_major.trim(),
        unit_minor: r.unit_minor.trim() || null,
        difficulty: r.difficulty || null,
        points: r.points,
      })),
    };

    startTransition(async () => {
      const result = await onSubmit(payload);
      if (!result.ok) setError(result.message);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 메타 */}
      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">시험지 정보</h2>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">제목 *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) OO고 2학년 6월 모의고사"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school">대상 학교</Label>
            <Input
              id="school"
              value={targetSchool}
              onChange={(e) => setTargetSchool(e.target.value)}
              placeholder="OO고등학교"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grade">학년</Label>
            <Select
              value={targetGrade || undefined}
              onValueChange={(v) => setTargetGrade(v)}
            >
              <SelectTrigger id="grade" className="w-full">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1학년</SelectItem>
                <SelectItem value="2">2학년</SelectItem>
                <SelectItem value="3">3학년</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="testDate">시험일</Label>
            <Input
              id="testDate"
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* 문항 그리드 */}
      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">문항 ({rows.length}문항)</h2>
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus className="size-4" /> 문항 추가
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] pl-4">번호</TableHead>
              <TableHead className="w-[100px]">정답</TableHead>
              <TableHead>대단원 *</TableHead>
              <TableHead>소단원</TableHead>
              <TableHead className="w-[100px]">난이도</TableHead>
              <TableHead className="w-[80px]">배점</TableHead>
              <TableHead className="w-[60px] pr-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell className="pl-4 font-medium">
                  {row.question_no}
                </TableCell>
                <TableCell>
                  <Select
                    value={row.correct_answer ? String(row.correct_answer) : undefined}
                    onValueChange={(v) =>
                      updateRow(idx, { correct_answer: Number(v) })
                    }
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">①</SelectItem>
                      <SelectItem value="2">②</SelectItem>
                      <SelectItem value="3">③</SelectItem>
                      <SelectItem value="4">④</SelectItem>
                      <SelectItem value="5">⑤</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <UnitInput
                    value={row.unit_major}
                    onChange={(v) => updateRow(idx, { unit_major: v })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.unit_minor}
                    onChange={(e) =>
                      updateRow(idx, { unit_minor: e.target.value })
                    }
                    placeholder="(선택)"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={row.difficulty || undefined}
                    onValueChange={(v) =>
                      updateRow(idx, { difficulty: v as Row["difficulty"] })
                    }
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTY.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    value={row.points}
                    onChange={(e) =>
                      updateRow(idx, { points: Number(e.target.value) || 1 })
                    }
                  />
                </TableCell>
                <TableCell className="pr-4">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeRow(idx)}
                    disabled={rows.length === 1}
                    className="size-8"
                    aria-label="문항 삭제"
                  >
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "저장 중..."
            : (submitLabel ?? (mode === "create" ? "시험지 생성" : "변경 저장"))}
        </Button>
      </div>
    </form>
  );
}

function UnitInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1">
      <Select
        value={UNIT_MAJOR_PRESETS.includes(value as never) ? value : undefined}
        onValueChange={onChange}
      >
        <SelectTrigger size="sm" className="w-[88px]">
          <SelectValue placeholder="선택" />
        </SelectTrigger>
        <SelectContent>
          {UNIT_MAJOR_PRESETS.map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="또는 직접 입력"
        className="flex-1"
      />
    </div>
  );
}
