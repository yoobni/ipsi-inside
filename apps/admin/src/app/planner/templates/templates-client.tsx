"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, Users } from "lucide-react";
import { addDaysIso, dateOfDay, shortDayLabel, weekStartOf } from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  applyPlannerTemplateAction,
  deletePlannerTemplateAction,
} from "../actions";

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  block_count: number;
  korean_minutes: number;
  task_count: number;
  damaged: boolean;
};
export type StudentChoice = {
  id: string;
  full_name: string;
  school: string | null;
  grade: number | null;
};
type GroupChoice = { id: string; name: string };

function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export function TemplatesClient({
  templates,
  students,
  groups,
  defaultWeekStart,
}: {
  templates: TemplateRow[];
  students: StudentChoice[];
  groups: GroupChoice[];
  defaultWeekStart: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const [assignTarget, setAssignTarget] = useState<TemplateRow | null>(null);
  const [weekStart, setWeekStart] = useState(defaultWeekStart);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [publish, setPublish] = useState(true);
  const [search, setSearch] = useState("");

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.school ?? "").toLowerCase().includes(q),
    );
  }, [students, search]);

  const openAssign = (t: TemplateRow) => {
    setAssignTarget(t);
    setWeekStart(defaultWeekStart);
    setStudentIds([]);
    setGroupIds([]);
    setOverwrite(false);
    setPublish(true);
    setSearch("");
    setMessage(null);
  };

  const submitAssign = () => {
    if (!assignTarget) return;
    if (studentIds.length === 0 && groupIds.length === 0) {
      setMessage({ kind: "error", text: "학생 또는 그룹을 선택해주세요" });
      return;
    }
    startTransition(async () => {
      const res = await applyPlannerTemplateAction({
        template_id: assignTarget.id,
        week_start: weekStart,
        student_ids: studentIds,
        group_ids: groupIds,
        on_conflict: overwrite ? "overwrite" : "skip",
        publish,
      });
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message });
        return;
      }
      const skipNote =
        res.skipped > 0
          ? ` (이미 플래너가 있어 건너뜀 ${res.skipped}명: ${res.skippedNames.slice(0, 3).join(", ")}${res.skippedNames.length > 3 ? " 외" : ""})`
          : "";
      setMessage({
        kind: "ok",
        text: `${res.applied}명에게 배정했어요${skipNote}`,
      });
      setAssignTarget(null);
      router.refresh();
    });
  };

  const remove = (t: TemplateRow) => {
    startTransition(async () => {
      const res = await deletePlannerTemplateAction(t.id);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message });
        return;
      }
      setMessage({ kind: "ok", text: `'${t.name}' 템플릿을 삭제했어요` });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {message && (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {templates.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border bg-card p-8 text-center text-sm">
          저장된 템플릿이 없어요. 주간 플래너에서 한 주를 구성한 뒤 &ldquo;템플릿으로
          저장&rdquo;을 눌러주세요.
        </div>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  {t.damaged && (
                    <Badge variant="warning">
                      <AlertTriangle className="size-3" /> 내용 손상
                    </Badge>
                  )}
                </div>
                {t.description && (
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {t.description}
                  </p>
                )}
                <p className="text-muted-foreground mt-1 text-xs">
                  블록 {t.block_count}개 · 국어 {hoursLabel(t.korean_minutes)} ·
                  과제 {t.task_count}개
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  onClick={() => openAssign(t)}
                  disabled={pending || t.damaged}
                >
                  <Users /> 일괄 배정
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="템플릿 삭제"
                  onClick={() => remove(t)}
                  disabled={pending}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={assignTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{assignTarget?.name} 배정</SheetTitle>
            <SheetDescription>
              선택한 학생과 그룹의 현재 멤버 모두에게 이 주간 구성을 복사해요.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            <div className="space-y-2">
              <Label htmlFor="assign-week">배정할 주</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStart(addDaysIso(weekStart, -7))}
                >
                  이전 주
                </Button>
                <Input
                  id="assign-week"
                  type="date"
                  value={weekStart}
                  onChange={(e) =>
                    e.target.value &&
                    setWeekStart(weekStartOf(e.target.value))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStart(addDaysIso(weekStart, 7))}
                >
                  다음 주
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                {shortDayLabel(weekStart)} ~ {shortDayLabel(dateOfDay(weekStart, 6))}
                {" · 월요일 시작으로 자동 정렬돼요"}
              </p>
            </div>

            {groups.length > 0 && (
              <div className="space-y-2">
                <Label>그룹(반)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((g) => {
                    const on = groupIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() =>
                          setGroupIds(
                            on
                              ? groupIds.filter((id) => id !== g.id)
                              : [...groupIds, g.id],
                          )
                        }
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-sm transition-colors",
                          on
                            ? "bg-primary text-primary-foreground border-primary font-medium"
                            : "hover:bg-muted",
                        )}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-muted-foreground text-xs">
                  배정 시점의 그룹 멤버에게 복사돼요 (이후 멤버 변경은 따라가지
                  않아요).
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>학생 직접 선택</Label>
                <span className="text-muted-foreground text-xs">
                  {studentIds.length}명 선택
                </span>
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름/학교 검색"
              />
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                {filteredStudents.length === 0 ? (
                  <p className="text-muted-foreground p-2 text-sm">
                    해당하는 학생이 없어요
                  </p>
                ) : (
                  filteredStudents.map((s) => {
                    const on = studentIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setStudentIds(
                              on
                                ? studentIds.filter((id) => id !== s.id)
                                : [...studentIds, s.id],
                            )
                          }
                          className="size-4"
                        />
                        <span className="font-medium">{s.full_name}</span>
                        <span className="text-muted-foreground text-xs">
                          {s.school ?? ""}
                          {s.grade ? ` ${s.grade}학년` : ""}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publish}
                  onChange={(e) => setPublish(e.target.checked)}
                  className="mt-0.5 size-4"
                />
                <span>
                  배정과 동시에 발행
                  <span className="text-muted-foreground block text-xs">
                    끄면 초안으로 들어가고, 학생에게는 보이지 않아요.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="mt-0.5 size-4"
                />
                <span>
                  이미 플래너가 있으면 덮어쓰기
                  <span className="text-muted-foreground block text-xs">
                    끄면 건너뛰어요.
                  </span>
                </span>
              </label>

              {overwrite && (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertDescription>
                    덮어쓰면 그 주에 학생이 이미 체크한 O/△/X 기록도 함께
                    사라져요.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <SheetFooter>
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignTarget(null)}
                className="flex-1"
                disabled={pending}
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={submitAssign}
                className="flex-1"
                disabled={pending}
              >
                {pending ? "배정 중…" : "배정"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
