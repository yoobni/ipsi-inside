"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronRight, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { assignStudentsAction, unassignStudentAction } from "../actions";

type Student = {
  id: string;
  full_name: string;
  phone: string;
  school: string | null;
  grade: number | null;
};

type AssignedStudent = Student & {
  status: string;
  assigned_at: string;
};

export function TestDetailClient({
  testSheetId,
  assignedStudents,
  availableStudents,
  gradedCount,
}: {
  testSheetId: string;
  assignedStudents: AssignedStudent[];
  availableStudents: Student[];
  gradedCount: number;
}) {
  const [assignOpen, setAssignOpen] = useState(false);

  return (
    <>
      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">배정된 학생</h2>
            <Badge variant="primary">{assignedStudents.length}명</Badge>
            <span className="text-muted-foreground">·</span>
            <Badge
              variant={
                gradedCount === assignedStudents.length && assignedStudents.length > 0
                  ? "success"
                  : "outline"
              }
            >
              {gradedCount}명 채점 완료
            </Badge>
          </div>
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            <UserPlus className="size-4" /> 학생 배정
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">이름</TableHead>
              <TableHead>소속</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="pr-4 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignedStudents.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground h-24 text-center"
                >
                  배정된 학생이 없어요. 우측 [학생 배정]을 눌러 추가해주세요.
                </TableCell>
              </TableRow>
            ) : (
              assignedStudents.map((s) => (
                <AssignedRow
                  key={s.id}
                  student={s}
                  testSheetId={testSheetId}
                />
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <AssignDrawer
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        testSheetId={testSheetId}
        availableStudents={availableStudents}
      />
    </>
  );
}

function AssignedRow({
  student,
  testSheetId,
}: {
  student: AssignedStudent;
  testSheetId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isGraded = student.status === "graded";

  return (
    <>
      <TableRow>
        <TableCell className="pl-4 font-medium">{student.full_name}</TableCell>
        <TableCell className="text-muted-foreground">
          {student.school}
          {student.grade ? ` · ${student.grade}학년` : ""}
        </TableCell>
        <TableCell>
          {isGraded ? (
            <Badge variant="success">
              <CheckCircle2 className="size-3" /> 채점 완료
            </Badge>
          ) : (
            <Badge variant="warning">대기</Badge>
          )}
        </TableCell>
        <TableCell className="pr-4 text-right">
          <div className="inline-flex items-center gap-1">
            <Button asChild size="sm" variant={isGraded ? "outline" : "default"}>
              <Link href={`/tests/${testSheetId}/grade?studentId=${student.id}`}>
                {isGraded ? "수정" : "채점"}
                <ChevronRight className="size-3" />
              </Link>
            </Button>
            {!isGraded && (
              <Button
                size="icon"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const r = await unassignStudentAction(
                      testSheetId,
                      student.id,
                    );
                    if (!r.ok) setError(r.message);
                  });
                }}
                aria-label="배정 해제"
                className="size-8"
              >
                <Trash2 className="text-destructive size-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {error && (
        <TableRow>
          <TableCell colSpan={4} className="pl-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function AssignDrawer({
  open,
  onClose,
  testSheetId,
  availableStudents,
}: {
  open: boolean;
  onClose: () => void;
  testSheetId: string;
  availableStudents: Student[];
}) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return availableStudents;
    return availableStudents.filter(
      (s) => s.full_name.includes(q) || s.phone.includes(q),
    );
  }, [availableStudents, query]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const handleAssign = () => {
    if (selectedIds.size === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await assignStudentsAction(
        testSheetId,
        Array.from(selectedIds),
      );
      if (result.ok) {
        setSelectedIds(new Set());
        onClose();
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>학생 배정</SheetTitle>
          <SheetDescription>
            이 시험지를 받을 학생을 선택하세요. 이미 배정된 학생은 목록에 없어요.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          <Input
            type="search"
            placeholder="이름/전화 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {filtered.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-primary text-xs font-medium hover:underline"
            >
              {allFilteredSelected ? "전체 해제" : "전체 선택"}
            </button>
          )}

          {filtered.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
              {availableStudents.length === 0
                ? "배정 가능한 승인된 학생이 없어요."
                : `"${query}" 검색 결과가 없어요.`}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {filtered.map((s) => {
                const checked = selectedIds.has(s.id);
                return (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.id)}
                        className="size-4 accent-current"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.full_name}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {s.phone}
                          {s.school ? ` · ${s.school}` : ""}
                          {s.grade ? ` ${s.grade}학년` : ""}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter className="border-t">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm">
              {selectedIds.size}명 선택됨
            </span>
            <Button
              onClick={handleAssign}
              disabled={pending || selectedIds.size === 0}
            >
              <Plus className="size-4" />
              {pending ? "처리 중..." : `${selectedIds.size}명 배정`}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
