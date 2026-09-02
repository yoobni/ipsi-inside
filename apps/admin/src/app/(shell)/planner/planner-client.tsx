"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  GRID_END_HOUR,
  GRID_START_MIN,
  MAX_BLOCK_END_MIN,
  GRID_HEIGHT,
  GRID_START_HOUR,
  HOUR_PX,
  minToY,
  useGridDrag,
  yToMin,
} from "./use-grid-drag";
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

/** 저장이 멎은 뒤 통계·총평을 다시 읽어오기까지 기다리는 시간 */
const STATS_REFRESH_DELAY_MS = 800;

const ALL_GROUPS = "__all__";
const NO_TAG = "__none__";

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
  syncKey,
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
  /** 학생-주차 식별자. 바뀌면 로컬 상태를 새 서버 값으로 맞춘다 */
  syncKey: string;
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
  // 블록 편집 오류는 시트 안에 띄운다 — 뒤 페이지에 띄우면 오버레이에 가려
  // 원장이 못 보고 넘어간다
  const [sheetError, setSheetError] = useState<string | null>(null);

  // 대신 "열면 내 블록이 보인다"는 초기 스크롤로 살린다.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrolledFor = useRef<string | null>(null);

  // 학생·주차가 바뀌면 렌더 중에 상태를 새 서버 값으로 되돌린다.
  // remount(key)로 처리하면 Radix Select가 닫히는 도중 언마운트돼
  // body 락이 남아 페이지 전체가 클릭을 안 받는다.
  const [syncedKey, setSyncedKey] = useState(syncKey);
  if (syncedKey !== syncKey) {
    setSyncedKey(syncKey);
    setBlocks(initialBlocks);
    setCurrentWeekId(weekId);
    setMessage(null);
    setEditIndex(undefined);
    setSheetError(null);
  }

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
    // transition으로 감싸면 서버 응답을 기다리는 동안 pending이 켜져
    // "눌렸는지 모르겠는" 상태가 사라진다 (force-dynamic이라 매번 왕복한다)
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  /**
   * 저장 뒤 서버 화면 갱신 — 마지막 저장 한 번으로 모은다.
   *
   * 저장은 드래그·편집 한 번마다 일어난다. 그때마다 router.refresh()를 부르면
   * 플래너 페이지 서버 렌더(쿼리 예닐곱 개)가 그 횟수만큼 다시 돌고, 라우터
   * 캐시까지 비워져 곧바로 누른 메뉴 이동이 매번 콜드로 시작한다. 여기서
   * 뒤늦게 맞으면 되는 값은 이행 통계·총평뿐이라 몰아서 한 번만 부른다.
   * (블록 자체는 저장 응답(res.blocks)으로 이미 확정 상태에 맞춰진다)
   */
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, STATS_REFRESH_DELAY_MS);
  };
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  /**
   * 블록 배열이 바뀔 때마다 곧바로 서버에 저장 — 저장 버튼을 따로 두면 작업이 유실된다.
   *
   * 화면을 먼저 바꿔놓고(낙관적) 저장하므로, 실패하면 **반드시 되돌려야** 한다.
   * 안 되돌리면 서버에 없는 블록이 타임테이블과 요약("국어 4시간")에 남아
   * 원장이 없는 일정을 있다고 믿은 채 발행한다.
   */
  const persist = (
    next: PlannerBlockInput[],
    opts?: {
      rollbackTo?: PlannerBlockInput[];
      onOk?: () => void;
      onFail?: (message: string) => void;
    },
  ) => {
    if (!selectedStudentId) return;
    setMessage(null);
    startTransition(async () => {
      const res = await savePlannerWeekAction({
        student_id: selectedStudentId,
        week_start: weekStart,
        blocks: next,
      });
      if (!res.ok) {
        if (opts?.rollbackTo) setBlocks(opts.rollbackTo);
        if (opts?.onFail) opts.onFail(res.message);
        else setMessage({ kind: "error", text: res.message });
        return;
      }
      const hadWeekRow = currentWeekId !== null;
      // 서버가 돌려준 확정 상태로 정렬 (신규 행의 id를 받아야 다음 저장이 중복되지 않음)
      setBlocks(res.blocks);
      setCurrentWeekId(res.week_id);
      opts?.onOk?.();
      setMessage({ kind: "ok", text: "저장했어요" });
      // 첫 저장은 이때 비로소 주차 행이 생긴다 — 통계·총평 영역이 "저장 전"
      // 안내에서 실제 화면으로 바뀌어야 하므로 미루지 않는다.
      if (hadWeekRow) scheduleRefresh();
      else router.refresh();
    });
  };

  /**
   * 신규 블록 시트. 격자에서 온 경우 요일·시간을 그 자리로 미리 채운다.
   *
   * 드래그가 끝나자마자 저장하지 않고 시트를 여는 이유: 국어 블록은 과제가
   * 1개 이상 있어야 저장된다(submitDraft 검증). 드래그만으로는 완성될 수 없다.
   */
  const openNew = (prefill?: { day: number; start: number; end: number }) => {
    const base = emptyDraft();
    setDraft(
      prefill
        ? {
            ...base,
            days: [prefill.day],
            start: minToHHMM(prefill.start),
            end: minToHHMM(prefill.end),
          }
        : base,
    );
    setSheetError(null);
    setEditIndex(null);
  };

  const openEdit = (index: number) => {
    setDraft(draftFromBlock(blocks[index]));
    setSheetError(null);
    setEditIndex(index);
  };

  const { drag, begin, move, end, cancel } = useGridDrag({
    blocks,
    gridRef,
    onCreate: (day, start, end) => openNew({ day, start, end }),
    onPick: (index) => openEdit(index),
    onCommit: (index, day, start_min, end_min) => {
      const previous = blocks;
      // id를 그대로 두는 게 핵심 — 새 행으로 만들면 학생 체크가 cascade로 날아간다
      const next = blocks.map((b, i) =>
        i === index ? { ...b, day_of_week: day, start_min, end_min } : b,
      );
      setBlocks(next);
      persist(next, { rollbackTo: previous });
    },
  });

  const closeSheet = () => {
    setSheetError(null);
    setEditIndex(undefined);
  };

  const submitDraft = () => {
    const startMin = hhmmToMin(draft.start);
    const endMin = hhmmToMin(draft.end);
    if (startMin === null || endMin === null) {
      setSheetError("시각 형식이 올바르지 않아요");
      return;
    }
    if (endMin <= startMin) {
      setSheetError("종료 시각이 시작보다 늦어야 해요");
      return;
    }
    // 격자는 06:00~24:00만 그린다. 밖으로 저장하면 저장은 되지만 타임테이블에서
    // 사라져서, 원장이 "만들었는데 없다"고 겪게 된다.
    if (startMin < GRID_START_MIN || endMin > MAX_BLOCK_END_MIN) {
      setSheetError(
        `시간표에 보이는 ${String(GRID_START_HOUR).padStart(2, "0")}:00~${minToHHMM(MAX_BLOCK_END_MIN)} 사이로 정해주세요`,
      );
      return;
    }
    if (draft.kind === "fixed" && !draft.label.trim()) {
      setSheetError("고정 일정 이름을 입력해주세요");
      return;
    }
    if (draft.days.length === 0) {
      setSheetError("요일을 선택해주세요");
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
      setSheetError("국어 블록에는 과제를 1개 이상 넣어주세요");
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

    // 시트는 저장이 확정된 뒤에 닫는다. 실패하면 열린 채로 오류를 보여주고
    // 화면 상태도 저장 전으로 되돌린다
    const previous = blocks;
    setSheetError(null);
    setBlocks(next);
    persist(next, {
      rollbackTo: previous,
      onOk: closeSheet,
      onFail: setSheetError,
    });
  };

  const removeBlock = () => {
    if (typeof editIndex !== "number") return;
    const previous = blocks;
    const next = blocks.filter((_, i) => i !== editIndex);
    setSheetError(null);
    setBlocks(next);
    persist(next, {
      rollbackTo: previous,
      onOk: closeSheet,
      onFail: setSheetError,
    });
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

  // 시간 범위는 06:00~24:00 고정 (use-grid-drag). 예전처럼 블록에 맞춰 자동으로
  // 좁히면 그 범위가 곧 "드래그로 만들 수 있는 시간의 한계"가 된다.
  const hours = useMemo(
    () =>
      Array.from(
        { length: GRID_END_HOUR - GRID_START_HOUR },
        (_, i) => GRID_START_HOUR + i,
      ),
    [],
  );

  // 초기 스크롤 위치는 아래 useEffect에서 정한다.
  useEffect(() => {
    if (!scrollRef.current || scrolledFor.current === syncKey) return;
    scrolledFor.current = syncKey;
    const earliest =
      blocks.length > 0
        ? Math.min(...blocks.map((b) => b.start_min))
        : 8 * 60;
    scrollRef.current.scrollTop = Math.max(0, minToY(earliest) - HOUR_PX / 2);
  }, [syncKey, blocks]);

  // 터치에서 고른 블록. 마우스는 본체를 바로 끌 수 있지만, 터치는 격자 스크롤과
  // 충돌해서 탭으로 고른 뒤 핸들에서만 끌게 한다.
  //
  // 값은 blocks 배열의 인덱스다. 저장하면 서버가 돌려준 배열로 갈아끼워져
  // 같은 인덱스가 다른 블록을 가리킬 수 있으므로, 배열이 바뀌면 선택을 푼다.
  const [touchPick, setTouchPick] = useState<number | null>(null);
  // 렌더 중 동기화 — 위 syncKey 처리와 같은 방식. effect에서 setState하면
  // 한 번 더 렌더가 돌고 lint가 cascading render로 잡는다.
  const [pickedFor, setPickedFor] = useState(blocks);
  if (pickedFor !== blocks) {
    setPickedFor(blocks);
    setTouchPick(null);
  }
  // 터치로 빈 칸을 "탭"했는지 판별 — 스크롤과 구분하려면 이동량을 봐야 한다
  const tapRef = useRef<{ x: number; y: number; day: number } | null>(null);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const koreanMinutes = blocks
    .filter((b) => b.kind === "korean")
    .reduce((sum, b) => sum + (b.end_min - b.start_min), 0);
  const taskCount = blocks.reduce((sum, b) => sum + (b.tasks?.length ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* 툴바 */}
      {/* 두 그룹으로 나눈다. 한 줄에 다 넣고 액션만 ml-auto로 밀면,
          폭이 좁아져 액션이 둘째 줄로 내려갈 때 그 줄 왼쪽이 통째로 빈다 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
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
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            onClick={() => openNew()}
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
        <div className="rounded-lg border bg-card">
          <div className="text-muted-foreground border-b px-3 py-1.5 text-[11px]">
            빈 칸을 끌면 새 블록 · 블록을 끌면 이동 · 아래끝을 끌면 시간 조절
            <span className="ml-1 md:hidden">
              (폰에서는 블록을 한 번 눌러 고른 뒤 손잡이를 끄세요)
            </span>
          </div>
          {/* 06~24시를 다 그리므로 세로로 스크롤된다. 요일 머리는 붙여둔다. */}
          <div ref={scrollRef} className="max-h-[68vh] overflow-auto">
            <div className="min-w-[720px]">
              {/* 요일 헤더 */}
              <div className="bg-card sticky top-0 z-20 grid grid-cols-[52px_1fr] border-b">
                <div />
                <div className="grid grid-cols-7">
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
              </div>

              {/* 본문 */}
              <div className="grid grid-cols-[52px_1fr]">
                {/* 시간 눈금 */}
                <div className="relative" style={{ height: GRID_HEIGHT }}>
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

                {/* 좌표 계산 기준 — 정확히 7개 열만 감싼다 */}
                <div
                  ref={gridRef}
                  className={cn(
                    "relative grid grid-cols-7",
                    drag && "select-none",
                  )}
                  style={{ height: GRID_HEIGHT }}
                >
                  {DAY_LABELS.map((label, day) => (
                    <div
                      key={label}
                      className="relative border-l"
                      onPointerDown={(e) => {
                        // 빈 칸 쓸어서 만들기는 마우스만. 터치로 열면 격자
                        // 스크롤과 충돌한다 (아래 onPointerUp에서 탭만 받는다).
                        if (e.pointerType !== "mouse") {
                          tapRef.current = {
                            x: e.clientX,
                            y: e.clientY,
                            day,
                          };
                          return;
                        }
                        begin(e, "create");
                      }}
                      onPointerMove={move}
                      onPointerUp={(e) => {
                        if (e.pointerType !== "mouse") {
                          const t = tapRef.current;
                          tapRef.current = null;
                          if (
                            t &&
                            Math.abs(e.clientX - t.x) < 8 &&
                            Math.abs(e.clientY - t.y) < 8
                          ) {
                            const rect =
                              gridRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            const min = yToMin(e.clientY - rect.top);
                            setTouchPick(null);
                            openNew({
                              day: t.day,
                              start: Math.min(min, MAX_BLOCK_END_MIN - 120),
                              end: Math.min(min + 120, MAX_BLOCK_END_MIN),
                            });
                          }
                          return;
                        }
                        end(e);
                      }}
                      onPointerCancel={cancel}
                    >
                      {/* 시간선 */}
                      {hours.map((h, i) => (
                        <div
                          key={h}
                          className="border-border/60 absolute inset-x-0 border-t border-dashed"
                          style={{ top: i * HOUR_PX }}
                        />
                      ))}

                      {blocks.map((b, index) => {
                        if (b.day_of_week !== day) return null;
                        const top = minToY(b.start_min);
                        const height = minToY(b.end_min) - top - 2;
                        const dragging = drag?.index === index;
                        const picked = touchPick === index;
                        return (
                          <div
                            key={b.id ?? `new-${index}`}
                            className={cn(
                              "absolute inset-x-0.5 rounded-md border",
                              dragging && "opacity-30",
                              picked && "ring-primary z-10 ring-2",
                              b.kind === "korean"
                                ? KOREAN_COLOR_CLASS
                                : (FIXED_COLOR_CLASS[b.color ?? "slate"] ??
                                  FIXED_COLOR_CLASS.slate),
                            )}
                            style={{ top, height: Math.max(height, 18) }}
                          >
                            <button
                              type="button"
                              aria-label={`${label}요일 ${minToHHMM(b.start_min)}부터 ${minToHHMM(b.end_min)}까지 ${b.kind === "korean" ? "국어" : b.label} 블록`}
                              className="size-full cursor-grab overflow-hidden px-1.5 py-1 text-left text-[11px] leading-tight active:cursor-grabbing"
                              onPointerDown={(e) => {
                                if (e.pointerType !== "mouse") {
                                  // 터치는 여기서 끌지 않는다 — 고르기만 한다
                                  e.stopPropagation();
                                  return;
                                }
                                begin(e, "move", index);
                              }}
                              onPointerMove={move}
                              onPointerUp={(e) => {
                                if (e.pointerType !== "mouse") {
                                  e.stopPropagation();
                                  // 이미 고른 블록을 다시 누르면 편집
                                  if (picked) openEdit(index);
                                  else setTouchPick(index);
                                  return;
                                }
                                end(e);
                              }}
                              onPointerCancel={cancel}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openEdit(index);
                                }
                              }}
                            >
                              <div className="font-semibold">
                                {b.kind === "korean" ? "국어" : b.label}
                              </div>
                              <div className="opacity-80 tabular-nums">
                                {minToHHMM(b.start_min)}~{minToHHMM(b.end_min)}
                              </div>
                              {b.kind === "korean" &&
                                (b.tasks ?? []).map((t, ti) => (
                                  <div key={t.id ?? ti} className="truncate">
                                    · {t.title}
                                  </div>
                                ))}
                            </button>

                            {/* 길이 조절 — 마우스는 아래끝 6px, 터치는 고른 뒤 큰 손잡이 */}
                            <div
                              role="presentation"
                              onPointerDown={(e) => begin(e, "resize", index)}
                              onPointerMove={move}
                              onPointerUp={end}
                              onPointerCancel={cancel}
                              className={cn(
                                "absolute inset-x-0 bottom-0 cursor-ns-resize",
                                picked ? "h-7" : "hidden h-1.5 md:block",
                              )}
                              // 손잡이에서만 브라우저 제스처를 끈다 — 격자 스크롤과 안 싸운다
                              style={{ touchAction: "none" }}
                            >
                              {picked && (
                                <div className="bg-primary mx-auto mt-1 h-1.5 w-10 rounded-full" />
                              )}
                            </div>

                            {/* 터치 이동 손잡이 */}
                            {picked && (
                              <div
                                role="presentation"
                                onPointerDown={(e) => begin(e, "move", index)}
                                onPointerMove={move}
                                onPointerUp={end}
                                onPointerCancel={cancel}
                                style={{ touchAction: "none" }}
                                className="bg-primary text-primary-foreground absolute -top-3 left-1/2 flex h-6 w-12 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold"
                              >
                                이동
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* 드래그 미리보기 — 겹치면 빨갛게, 놓아도 저장하지 않는다 */}
                  {drag && (
                    <div
                      className={cn(
                        "pointer-events-none absolute z-30 rounded-md border-2",
                        drag.invalid
                          ? "border-destructive bg-destructive/20"
                          : "border-primary bg-primary/20",
                      )}
                      style={{
                        left: `${(drag.day / 7) * 100}%`,
                        width: `${100 / 7}%`,
                        top: minToY(drag.start_min),
                        height: Math.max(
                          minToY(drag.end_min) - minToY(drag.start_min),
                          16,
                        ),
                      }}
                    >
                      <div className="px-1 py-0.5 text-[10px] font-bold tabular-nums">
                        {minToHHMM(drag.start_min)}~{minToHHMM(drag.end_min)}
                      </div>
                      {drag.invalid && (
                        <div className="text-destructive px-1 text-[10px] font-bold">
                          겹침
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
            {sheetError && (
              <Alert variant="destructive">
                <AlertDescription>{sheetError}</AlertDescription>
              </Alert>
            )}

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
                  min="06:00"
                  max="23:55"
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
                  min="06:05"
                  max="23:59"
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
