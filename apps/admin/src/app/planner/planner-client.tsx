"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  DAY_LABELS,
  FIXED_BLOCK_COLORS,
  addDaysIso,
  dateOfDay,
  hhmmToMin,
  minToHHMM,
  shortDayLabel,
  stripBlockIds,
  type PlannerBlockInput,
  type PlannerBlockKind,
  type PlannerTaskInput,
} from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  savePlannerWeekAction,
  publishPlannerWeekAction,
  savePlannerTemplateAction,
} from "./actions";

export type PlannerStudent = {
  id: string;
  full_name: string;
  school: string | null;
  grade: number | null;
};
export type PlannerTagChoice = { id: string; name: string; color: string | null };
export type PlannerTemplateChoice = {
  id: string;
  name: string;
  blocks: PlannerBlockInput[];
};
type GroupChoice = { id: string; name: string };

const ALL_GROUPS = "__all__";
const NO_TAG = "__none__";
const HOUR_PX = 44;

/** Tailwind는 동적 클래스명을 못 뽑아내므로 색상은 정적 맵으로 */
const FIXED_COLOR_CLASS: Record<string, string> = {
  slate:
    "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800/60 dark:border-slate-600 dark:text-slate-200",
  sky: "bg-sky-100 border-sky-300 text-sky-800 dark:bg-sky-950/50 dark:border-sky-700 dark:text-sky-200",
  emerald:
    "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-200",
  violet:
    "bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-950/50 dark:border-violet-700 dark:text-violet-200",
  rose: "bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-950/50 dark:border-rose-700 dark:text-rose-200",
};
const KOREAN_COLOR_CLASS =
  "bg-orange-100 border-orange-400 text-orange-900 dark:bg-orange-950/60 dark:border-orange-600 dark:text-orange-100";

const FIXED_COLOR_LABEL: Record<string, string> = {
  slate: "회색",
  sky: "파랑",
  emerald: "초록",
  violet: "보라",
  rose: "빨강",
};

type BlockDraft = {
  kind: PlannerBlockKind;
  days: number[]; // 신규 추가 시 여러 요일에 한 번에
  start: string; // "HH:MM"
  end: string;
  label: string;
  color: string;
  memo: string;
  tasks: PlannerTaskInput[];
};

function emptyDraft(): BlockDraft {
  return {
    kind: "korean",
    days: [0],
    start: "19:00",
    end: "21:00",
    label: "",
    color: "slate",
    memo: "",
    tasks: [{ title: "", tag_id: null }],
  };
}

function draftFromBlock(b: PlannerBlockInput): BlockDraft {
  return {
    kind: b.kind,
    days: [b.day_of_week],
    start: minToHHMM(b.start_min),
    end: minToHHMM(b.end_min),
    label: b.label ?? "",
    color: b.color ?? "slate",
    memo: b.memo ?? "",
    tasks:
      b.tasks && b.tasks.length > 0
        ? b.tasks.map((t) => ({ id: t.id, title: t.title, tag_id: t.tag_id ?? null }))
        : [{ title: "", tag_id: null }],
  };
}

export function PlannerClient({
  students,
  groups,
  selectedGroupId,
  selectedStudentId,
  weekStart,
  weekId,
  weekStatus,
  initialBlocks,
  tags,
  templates,
}: {
  students: PlannerStudent[];
  groups: GroupChoice[];
  selectedGroupId: string | null;
  selectedStudentId: string | null;
  weekStart: string;
  weekId: string | null;
  weekStatus: "draft" | "published";
  initialBlocks: PlannerBlockInput[];
  tags: PlannerTagChoice[];
  templates: PlannerTemplateChoice[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [blocks, setBlocks] = useState<PlannerBlockInput[]>(initialBlocks);
  const [currentWeekId, setCurrentWeekId] = useState<string | null>(weekId);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  // 편집 중인 블록의 인덱스. null이면 신규 추가, undefined면 시트 닫힘
  const [editIndex, setEditIndex] = useState<number | null | undefined>(undefined);
  const [draft, setDraft] = useState<BlockDraft>(emptyDraft);

  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  // 불러오기는 기존 블록을 갈아끼우므로 한 번 확인을 받는다
  const [pendingLoadId, setPendingLoadId] = useState<string | null>(null);

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  /** 블록 배열이 바뀔 때마다 곧바로 서버에 저장 — 저장 버튼을 따로 두면 작업이 유실된다 */
  const persist = (next: PlannerBlockInput[]) => {
    if (!selectedStudentId) return;
    setMessage(null);
    startTransition(async () => {
      const res = await savePlannerWeekAction({
        student_id: selectedStudentId,
        week_start: weekStart,
        blocks: next,
      });
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message });
        return;
      }
      // 서버가 돌려준 확정 상태로 정렬 (신규 행의 id를 받아야 다음 저장이 중복되지 않음)
      setBlocks(res.blocks);
      setCurrentWeekId(res.week_id);
      setMessage({ kind: "ok", text: "저장했어요" });
      router.refresh();
    });
  };

  const openNew = () => {
    setDraft(emptyDraft());
    setEditIndex(null);
  };

  const openEdit = (index: number) => {
    setDraft(draftFromBlock(blocks[index]));
    setEditIndex(index);
  };

  const closeSheet = () => setEditIndex(undefined);

  const submitDraft = () => {
    const startMin = hhmmToMin(draft.start);
    const endMin = hhmmToMin(draft.end);
    if (startMin === null || endMin === null) {
      setMessage({ kind: "error", text: "시각 형식이 올바르지 않아요" });
      return;
    }
    if (endMin <= startMin) {
      setMessage({ kind: "error", text: "종료 시각이 시작보다 늦어야 해요" });
      return;
    }
    if (draft.kind === "fixed" && !draft.label.trim()) {
      setMessage({ kind: "error", text: "고정 일정 이름을 입력해주세요" });
      return;
    }
    if (draft.days.length === 0) {
      setMessage({ kind: "error", text: "요일을 선택해주세요" });
      return;
    }

    const tasks =
      draft.kind === "korean"
        ? draft.tasks
            .filter((t) => t.title.trim().length > 0)
            .map((t) => ({
              id: t.id,
              title: t.title.trim(),
              tag_id: t.tag_id ?? null,
            }))
        : [];

    if (draft.kind === "korean" && tasks.length === 0) {
      setMessage({ kind: "error", text: "국어 블록에는 과제를 1개 이상 넣어주세요" });
      return;
    }

    const base = {
      start_min: startMin,
      end_min: endMin,
      kind: draft.kind,
      label: draft.kind === "fixed" ? draft.label.trim() : null,
      color: draft.kind === "fixed" ? draft.color : null,
      memo: draft.memo.trim() || null,
      tasks,
    };

    let next: PlannerBlockInput[];
    if (editIndex === null) {
      // 신규 — 선택한 요일 수만큼 한 번에 생성
      const added = draft.days.map((d) => ({ ...base, day_of_week: d, tasks: tasks.map((t) => ({ title: t.title, tag_id: t.tag_id })) }));
      next = [...blocks, ...added];
    } else if (typeof editIndex === "number") {
      next = blocks.map((b, i) =>
        i === editIndex
          ? { ...base, id: b.id, day_of_week: draft.days[0] }
          : b,
      );
    } else {
      return;
    }

    setBlocks(next);
    closeSheet();
    persist(next);
  };

  const removeBlock = () => {
    if (typeof editIndex !== "number") return;
    const next = blocks.filter((_, i) => i !== editIndex);
    setBlocks(next);
    closeSheet();
    persist(next);
  };

  const saveAsTemplate = () => {
    if (blocks.length === 0) {
      setMessage({ kind: "error", text: "저장할 블록이 없어요" });
      return;
    }
    startTransition(async () => {
      const res = await savePlannerTemplateAction({
        name: tplName,
        description: tplDesc || null,
        blocks,
      });
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message });
        return;
      }
      setSaveTplOpen(false);
      setTplName("");
      setTplDesc("");
      setMessage({ kind: "ok", text: "템플릿으로 저장했어요" });
      router.refresh();
    });
  };

  /** 템플릿 불러오기 — 이 주차 블록을 템플릿 구성으로 갈아끼운다 */
  const loadTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    // 템플릿 블록에는 id가 없으므로 전부 신규 행으로 들어간다
    const next = stripBlockIds(tpl.blocks);
    setBlocks(next);
    setPendingLoadId(null);
    persist(next);
  };

  const requestLoad = (templateId: string) => {
    if (blocks.length === 0) {
      loadTemplate(templateId);
      return;
    }
    setPendingLoadId(templateId);
  };

  const togglePublish = () => {
    if (!currentWeekId) return;
    setMessage(null);
    startTransition(async () => {
      const res = await publishPlannerWeekAction(
        currentWeekId,
        weekStatus !== "published",
      );
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message });
        return;
      }
      setMessage({
        kind: "ok",
        text:
          weekStatus === "published"
            ? "발행을 취소했어요"
            : "발행했어요. 학생에게 알림이 갔어요",
      });
      router.refresh();
    });
  };

  // 표시할 시간 범위 — 블록이 있으면 그에 맞추고, 없으면 08:00~24:00
  const { startHour, endHour } = useMemo(() => {
    if (blocks.length === 0) return { startHour: 8, endHour: 24 };
    const min = Math.min(...blocks.map((b) => b.start_min));
    const max = Math.max(...blocks.map((b) => b.end_min));
    return {
      startHour: Math.max(0, Math.floor(min / 60) - 1),
      endHour: Math.min(24, Math.ceil(max / 60) + 1),
    };
  }, [blocks]);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour],
  );
  const gridHeight = (endHour - startHour) * HOUR_PX;

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const koreanMinutes = blocks
    .filter((b) => b.kind === "korean")
    .reduce((sum, b) => sum + (b.end_min - b.start_min), 0);
  const taskCount = blocks.reduce((sum, b) => sum + (b.tasks?.length ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Select
          value={selectedGroupId ?? ALL_GROUPS}
          onValueChange={(v) => setParam("group", v === ALL_GROUPS ? null : v)}
        >
          <SelectTrigger className="w-[150px]" aria-label="그룹 필터">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_GROUPS}>전체 학생</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedStudentId ?? ""}
          onValueChange={(v) => setParam("student", v)}
        >
          <SelectTrigger className="w-[190px]" aria-label="학생 선택">
            <SelectValue placeholder="학생 선택" />
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name}
                {s.school ? ` · ${s.school}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="이전 주"
            onClick={() => setParam("week", addDaysIso(weekStart, -7))}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-[150px] text-center text-sm font-medium">
            {shortDayLabel(weekStart)} ~ {shortDayLabel(dateOfDay(weekStart, 6))}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="다음 주"
            onClick={() => setParam("week", addDaysIso(weekStart, 7))}
          >
            <ChevronRight />
          </Button>
        </div>

        <Badge variant={weekStatus === "published" ? "success" : "warning"}>
          {weekStatus === "published" ? "발행됨" : "초안"}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={openNew}
            disabled={!selectedStudentId || pending}
          >
            <Plus /> 블록 추가
          </Button>
          <Button
            onClick={togglePublish}
            disabled={!currentWeekId || pending}
            variant={weekStatus === "published" ? "outline" : "default"}
          >
            {weekStatus === "published" ? "발행 취소" : "발행"}
          </Button>
        </div>
      </div>

      {/* 템플릿 줄 */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <span className="text-muted-foreground text-xs font-medium">템플릿</span>

        <Select value="" onValueChange={requestLoad}>
          <SelectTrigger className="w-[200px]" aria-label="템플릿 불러오기">
            <SelectValue placeholder="불러오기" />
          </SelectTrigger>
          <SelectContent>
            {templates.length === 0 ? (
              <SelectItem value="__none__" disabled>
                저장된 템플릿 없음
              </SelectItem>
            ) : (
              templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSaveTplOpen(true)}
          disabled={blocks.length === 0 || pending}
        >
          <Save /> 이 주차를 템플릿으로
        </Button>

        <Button variant="ghost" size="sm" asChild className="ml-auto">
          <Link href="/planner/templates">
            <Settings2 /> 템플릿 관리 · 일괄 배정
          </Link>
        </Button>
      </div>

      {pendingLoadId && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>
            <div className="space-y-2">
              <p>
                불러오면 이 주차의 블록 {blocks.length}개가 템플릿 구성으로
                교체돼요. 학생이 이미 체크한 기록도 함께 사라집니다.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingLoadId(null)}
                  disabled={pending}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => loadTemplate(pendingLoadId)}
                  disabled={pending}
                >
                  교체하고 불러오기
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {students.length === 0 && (
        <Alert>
          <AlertDescription>
            {selectedGroupId
              ? "이 그룹에 속한 승인된 학생이 없어요."
              : "승인된 학생이 없어요. 가입 승인을 먼저 해주세요."}
          </AlertDescription>
        </Alert>
      )}

      {selectedStudent && (
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="text-foreground font-medium">
              {selectedStudent.full_name}
            </span>
            {selectedStudent.school ? ` · ${selectedStudent.school}` : ""}
            {selectedStudent.grade ? ` ${selectedStudent.grade}학년` : ""}
          </span>
          <span>
            국어 {Math.floor(koreanMinutes / 60)}시간
            {koreanMinutes % 60 ? ` ${koreanMinutes % 60}분` : ""} · 과제{" "}
            {taskCount}개
          </span>
        </div>
      )}

      {/* 타임테이블 */}
      {selectedStudentId && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <div className="min-w-[720px]">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b">
              <div />
              {DAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  className="border-l px-2 py-2 text-center text-xs"
                >
                  <div className="font-semibold">{label}</div>
                  <div className="text-muted-foreground">
                    {dateOfDay(weekStart, i).slice(5).replace("-", "/")}
                  </div>
                </div>
              ))}
            </div>

            {/* 본문 */}
            <div className="grid grid-cols-[52px_repeat(7,1fr)]">
              {/* 시간 눈금 */}
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[11px]"
                    style={{ top: i * HOUR_PX }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {DAY_LABELS.map((label, day) => (
                <div
                  key={label}
                  className="relative border-l"
                  style={{ height: gridHeight }}
                >
                  {/* 시간선 */}
                  {hours.map((h, i) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-dashed border-border/60"
                      style={{ top: i * HOUR_PX }}
                    />
                  ))}

                  {blocks.map((b, index) => {
                    if (b.day_of_week !== day) return null;
                    const top =
                      ((b.start_min - startHour * 60) / 60) * HOUR_PX;
                    const height =
                      ((b.end_min - b.start_min) / 60) * HOUR_PX - 2;
                    return (
                      <button
                        key={b.id ?? `new-${index}`}
                        type="button"
                        onClick={() => openEdit(index)}
                        className={cn(
                          "absolute inset-x-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-80",
                          b.kind === "korean"
                            ? KOREAN_COLOR_CLASS
                            : (FIXED_COLOR_CLASS[b.color ?? "slate"] ??
                              FIXED_COLOR_CLASS.slate),
                        )}
                        style={{ top, height: Math.max(height, 18) }}
                      >
                        <div className="font-semibold">
                          {b.kind === "korean" ? "국어" : b.label}
                        </div>
                        <div className="opacity-80">
                          {minToHHMM(b.start_min)}~{minToHHMM(b.end_min)}
                        </div>
                        {b.kind === "korean" &&
                          (b.tasks ?? []).map((t, ti) => (
                            <div key={t.id ?? ti} className="truncate">
                              · {t.title}
                            </div>
                          ))}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 블록 편집 시트 */}
      <Sheet
        open={editIndex !== undefined}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editIndex === null ? "블록 추가" : "블록 수정"}
            </SheetTitle>
            <SheetDescription>
              고정 일정은 색상 블록으로만 표시되고, 국어 블록에만 세부 과제를
              넣을 수 있어요.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            <div className="space-y-2">
              <Label>종류</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={draft.kind === "korean" ? "default" : "outline"}
                  onClick={() => setDraft({ ...draft, kind: "korean" })}
                  className="flex-1"
                >
                  국어
                </Button>
                <Button
                  type="button"
                  variant={draft.kind === "fixed" ? "default" : "outline"}
                  onClick={() => setDraft({ ...draft, kind: "fixed" })}
                  className="flex-1"
                >
                  고정 일정
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                요일
                {editIndex === null && (
                  <span className="text-muted-foreground ml-1 font-normal">
                    (여러 개 선택하면 한 번에 만들어져요)
                  </span>
                )}
              </Label>
              <div className="flex gap-1">
                {DAY_LABELS.map((label, i) => {
                  const on = draft.days.includes(i);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        if (editIndex === null) {
                          setDraft({
                            ...draft,
                            days: on
                              ? draft.days.filter((d) => d !== i)
                              : [...draft.days, i].sort((a, b) => a - b),
                          });
                        } else {
                          setDraft({ ...draft, days: [i] });
                        }
                      }}
                      className={cn(
                        "size-9 rounded-md border text-sm transition-colors",
                        on
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "hover:bg-muted",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="block-start">시작</Label>
                <Input
                  id="block-start"
                  type="time"
                  step={300}
                  value={draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="block-end">종료</Label>
                <Input
                  id="block-end"
                  type="time"
                  step={300}
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
              </div>
            </div>

            {draft.kind === "fixed" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="block-label">일정 이름</Label>
                  <Input
                    id="block-label"
                    value={draft.label}
                    onChange={(e) =>
                      setDraft({ ...draft, label: e.target.value })
                    }
                    placeholder="예) 학교, ○○수학학원"
                  />
                </div>
                <div className="space-y-2">
                  <Label>색상</Label>
                  <div className="flex gap-2">
                    {FIXED_BLOCK_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={FIXED_COLOR_LABEL[c]}
                        onClick={() => setDraft({ ...draft, color: c })}
                        className={cn(
                          "h-9 flex-1 rounded-md border text-xs",
                          FIXED_COLOR_CLASS[c],
                          draft.color === c && "ring-primary ring-2",
                        )}
                      >
                        {FIXED_COLOR_LABEL[c]}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>세부 과제</Label>
                {draft.tasks.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={t.title}
                      onChange={(e) => {
                        const tasks = [...draft.tasks];
                        tasks[i] = { ...tasks[i], title: e.target.value };
                        setDraft({ ...draft, tasks });
                      }}
                      placeholder="예) 비문학 독해 3지문"
                      className="flex-1"
                    />
                    <Select
                      value={t.tag_id ?? NO_TAG}
                      onValueChange={(v) => {
                        const tasks = [...draft.tasks];
                        tasks[i] = {
                          ...tasks[i],
                          tag_id: v === NO_TAG ? null : v,
                        };
                        setDraft({ ...draft, tasks });
                      }}
                    >
                      <SelectTrigger className="w-[130px]" aria-label="영역 태그">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TAG}>태그 없음</SelectItem>
                        {tags.map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            {tag.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="과제 삭제"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          tasks: draft.tasks.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      tasks: [...draft.tasks, { title: "", tag_id: null }],
                    })
                  }
                >
                  <Plus /> 과제 추가
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="block-memo">메모 (선택)</Label>
              <Textarea
                id="block-memo"
                value={draft.memo}
                onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
                rows={2}
                placeholder="학생에게 함께 보여줄 한 줄"
              />
            </div>
          </div>

          <SheetFooter>
            <div className="flex w-full gap-2">
              {typeof editIndex === "number" && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={removeBlock}
                  disabled={pending}
                >
                  삭제
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={closeSheet}
                className="ml-auto"
                disabled={pending}
              >
                취소
              </Button>
              <Button type="button" onClick={submitDraft} disabled={pending}>
                {pending ? "저장 중…" : "저장"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 템플릿으로 저장 */}
      <Sheet open={saveTplOpen} onOpenChange={setSaveTplOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>템플릿으로 저장</SheetTitle>
            <SheetDescription>
              지금 주차의 블록 {blocks.length}개를 표준 루틴으로 저장해요.
              학생·주차 정보는 담기지 않아요.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 px-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">템플릿 이름</Label>
              <Input
                id="tpl-name"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="예) 고3 내신반 표준 루틴"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">설명 (선택)</Label>
              <Textarea
                id="tpl-desc"
                value={tplDesc}
                onChange={(e) => setTplDesc(e.target.value)}
                rows={3}
                placeholder="언제 쓰는 루틴인지 메모"
              />
            </div>
          </div>

          <SheetFooter>
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSaveTplOpen(false)}
                className="flex-1"
                disabled={pending}
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={saveAsTemplate}
                className="flex-1"
                disabled={pending || !tplName.trim()}
              >
                {pending ? "저장 중…" : "저장"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
