"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { assignAction, unassignAction } from "../actions";

export type AssignedRow = {
  assignment_id: string;
  student_id: string;
  full_name: string;
  school: string | null;
  grade: number | null;
  assigned_at: string;
  assigned_by_school: string | null;
  latest_attempt_id: string | null;
  latest_status: "in_progress" | "submitted" | null;
  latest_score: number | null;
  latest_total_points: number | null;
  latest_attempt_no: number | null;
  latest_submitted_at: string | null;
};

export type AvailableStudent = {
  id: string;
  full_name: string;
  phone: string;
  school: string | null;
  grade: number | null;
};

export type GroupOption = { id: string; name: string; member_count: number };

export function TestDetailClient({
  testSheetId,
  assigned,
  availableStudents,
  distinctSchools,
  groups,
}: {
  testSheetId: string;
  assigned: AssignedRow[];
  availableStudents: AvailableStudent[];
  distinctSchools: string[];
  groups: GroupOption[];
}) {
  const [open, setOpen] = useState(false);

  const submittedCount = assigned.filter((a) => a.latest_status === "submitted").length;

  return (
    <>
      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">배정 학생</h2>
            <Badge variant="primary">{assigned.length}명 배정</Badge>
            <span className="text-muted-foreground">·</span>
            <Badge
              variant={
                submittedCount === assigned.length && assigned.length > 0
                  ? "success"
                  : "outline"
              }
            >
              {submittedCount}명 제출
            </Badge>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <UserPlus className="size-4" />
            배정 추가
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">이름</TableHead>
              <TableHead>소속</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>점수</TableHead>
              <TableHead className="pr-4 text-right">배정일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assigned.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  배정된 학생이 없어요. [배정 추가]로 학교/학생을 선택하세요.
                </TableCell>
              </TableRow>
            ) : (
              assigned.map((r) => (
                <AssignedRowItem
                  key={r.assignment_id}
                  row={r}
                  testSheetId={testSheetId}
                />
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <AssignDrawer
        open={open}
        onClose={() => setOpen(false)}
        testSheetId={testSheetId}
        availableStudents={availableStudents}
        distinctSchools={distinctSchools}
        groups={groups}
      />
    </>
  );
}

function AssignedRowItem({
  row,
  testSheetId,
}: {
  row: AssignedRow;
  testSheetId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleUnassign = () => {
    setError(null);
    startTransition(async () => {
      const r = await unassignAction(testSheetId, row.student_id);
      if (!r.ok) setError(r.message);
    });
  };

  return (
    <>
      <TableRow>
        <TableCell className="pl-4">
          <div className="font-medium">{row.full_name}</div>
          {row.assigned_by_school && (
            <div className="text-muted-foreground text-xs">
              학교 단위 배정: {row.assigned_by_school}
            </div>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {row.school}
          {row.grade ? ` · ${row.grade}학년` : ""}
        </TableCell>
        <TableCell>
          <StatusBadge status={row.latest_status} />
        </TableCell>
        <TableCell className="tabular-nums text-sm">
          {row.latest_status === "submitted" &&
          row.latest_score != null &&
          row.latest_total_points != null &&
          row.latest_attempt_id ? (
            <Link
              href={`/tests/${testSheetId}/attempts/${row.latest_attempt_id}`}
              className="inline-flex items-center gap-1 font-medium hover:underline"
            >
              {row.latest_score} / {row.latest_total_points}점
              {row.latest_attempt_no && row.latest_attempt_no > 1 && (
                <span className="text-muted-foreground ml-1 text-xs">
                  ({row.latest_attempt_no}회차)
                </span>
              )}
              <ArrowRight className="size-3" />
            </Link>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground pr-4 text-right text-xs">
          <div className="inline-flex items-center gap-1">
            <span>{new Date(row.assigned_at).toLocaleDateString("ko-KR")}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={pending || !!row.latest_status}
              onClick={handleUnassign}
              className="size-7"
              aria-label="배정 해제"
              title={
                row.latest_status
                  ? "응시 기록이 있어 해제 불가"
                  : "배정 해제"
              }
            >
              <Trash2
                className={cn(
                  "size-3.5",
                  row.latest_status ? "text-muted-foreground/40" : "text-destructive",
                )}
              />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {error && (
        <TableRow>
          <TableCell colSpan={5} className="pl-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function StatusBadge({
  status,
}: {
  status: "in_progress" | "submitted" | null;
}) {
  if (status === "submitted")
    return (
      <Badge variant="success">
        <CheckCircle2 className="size-3" /> 제출
      </Badge>
    );
  if (status === "in_progress")
    return (
      <Badge variant="warning">
        <Loader2 className="size-3" /> 응시 중
      </Badge>
    );
  return <Badge variant="outline">대기</Badge>;
}

function AssignDrawer({
  open,
  onClose,
  testSheetId,
  availableStudents,
  distinctSchools,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  testSheetId: string;
  availableStudents: AvailableStudent[];
  distinctSchools: string[];
  groups: GroupOption[];
}) {
  const [tab, setTab] = useState<"group" | "school" | "student">("group");
  const [selectedSchools, setSelectedSchools] = useState<Set<string>>(new Set());
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggleGroup = (id: string) => {
    setSelectedGroups((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredStudents = useMemo(() => {
    const q = query.trim();
    if (!q) return availableStudents;
    return availableStudents.filter(
      (s) => s.full_name.includes(q) || s.phone.includes(q),
    );
  }, [availableStudents, query]);

  const studentsBySchool = useMemo(() => {
    const m = new Map<string, number>();
    availableStudents.forEach((s) => {
      if (s.school) m.set(s.school, (m.get(s.school) ?? 0) + 1);
    });
    return m;
  }, [availableStudents]);

  const toggleSchool = (s: string) => {
    setSelectedSchools((p) => {
      const next = new Set(p);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalSelected =
    selectedSchools.size + selectedStudents.size + selectedGroups.size;

  const handleAssign = () => {
    if (totalSelected === 0) {
      setError("그룹/학교/학생 중 하나를 선택해주세요");
      return;
    }
    setError(null);
    const payload = {
      test_sheet_id: testSheetId,
      schools: Array.from(selectedSchools),
      student_ids: Array.from(selectedStudents),
      group_ids: Array.from(selectedGroups),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    startTransition(async () => {
      const r = await assignAction(null, fd);
      if (r.ok) {
        setSelectedSchools(new Set());
        setSelectedStudents(new Set());
        setSelectedGroups(new Set());
        onClose();
      } else {
        setError(r.message);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>배정 추가</SheetTitle>
          <SheetDescription>
            그룹/학교 선택 시 그 시점의 활성 학생 전체가 배정돼요(스냅샷). 나중에
            그룹에 들어온 학생은 이 시험에 자동 배정되지 않아요. 개별 학생도 함께 선택 가능.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "group" | "school" | "student")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="group" className="flex-1">
                그룹 {selectedGroups.size > 0 ? `(${selectedGroups.size})` : ""}
              </TabsTrigger>
              <TabsTrigger value="school" className="flex-1">
                학교 {selectedSchools.size > 0 ? `(${selectedSchools.size})` : ""}
              </TabsTrigger>
              <TabsTrigger value="student" className="flex-1">
                학생 {selectedStudents.size > 0 ? `(${selectedStudents.size})` : ""}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "group" ? (
            groups.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
                만든 그룹이 없어요. [그룹(반)] 메뉴에서 먼저 만들어주세요.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {groups.map((g) => {
                  const checked = selectedGroups.has(g.id);
                  return (
                    <li key={g.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroup(g.id)}
                          className="size-4 accent-current"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{g.name}</p>
                          <p className="text-muted-foreground text-xs">
                            현재 {g.member_count}명
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )
          ) : tab === "school" ? (
            distinctSchools.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
                활성 학생의 학교 정보가 없어요.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {distinctSchools.map((s) => {
                  const checked = selectedSchools.has(s);
                  const count = studentsBySchool.get(s) ?? 0;
                  return (
                    <li key={s}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSchool(s)}
                          className="size-4 accent-current"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{s}</p>
                          <p className="text-muted-foreground text-xs">
                            배정 가능 {count}명
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <>
              <Input
                type="search"
                placeholder="이름/전화 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {filteredStudents.length === 0 ? (
                <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
                  {availableStudents.length === 0
                    ? "배정 가능한 학생이 없어요."
                    : `"${query}" 결과 없음`}
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {filteredStudents.map((s) => {
                    const checked = selectedStudents.has(s.id);
                    return (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStudent(s.id)}
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
            </>
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
              그룹 {selectedGroups.size} · 학교 {selectedSchools.size} · 학생{" "}
              {selectedStudents.size}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} type="button" disabled={pending}>
                취소
              </Button>
              <Button onClick={handleAssign} disabled={pending || totalSelected === 0}>
                {pending ? "처리 중..." : "배정"}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

