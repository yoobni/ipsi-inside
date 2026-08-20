"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ChevronLeft, ChevronRight, Clock, Lock } from "lucide-react";
import {
  DAY_LABELS,
  LATE_REASON_PRESETS,
  PLANNER_CHECK_LABEL,
  PLANNER_CHECK_MARK,
  addDaysIso,
  minToHHMM,
  shortDayLabel,
  type PlannerCheckStatus,
} from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resizeImageToJpeg } from "@/lib/image-resize";
import { cn } from "@/lib/utils";
import { submitPlannerChecksAction } from "./actions";
import { uploadPlannerProofAction } from "./upload-proof";

type TaskView = {
  id: string;
  title: string;
  tag_name: string | null;
  status: PlannerCheckStatus | null;
  late_reason: string | null;
  photo_path: string | null;
  checked_at: string | null;
};
type BlockView = {
  id: string;
  start_min: number;
  end_min: number;
  kind: "korean" | "fixed";
  label: string | null;
  color: string | null;
  memo: string | null;
  tasks: TaskView[];
};
export type PlannerDay = {
  day_of_week: number;
  date: string;
  editable: boolean;
  blocks: BlockView[];
};

/**
 * 인증사진 URL. photo_path의 uuid를 v로 달아 캐시를 깬다 —
 * ?task=<id>만 쓰면 사진을 바꿔도 브라우저가 옛 이미지를 그대로 보여준다.
 */
function proofSrc(task: TaskView): string {
  const file = (task.photo_path ?? "").split("/").pop() ?? "";
  const version = file.split(".")[0];
  return `/dashboard/planner/proof?task=${task.id}&v=${version}`;
}

const STATUS_STYLE: Record<PlannerCheckStatus, string> = {
  done: "bg-emerald-500 text-white border-emerald-500",
  late: "bg-amber-500 text-white border-amber-500",
  missed: "bg-rose-500 text-white border-rose-500",
};

const FIXED_DOT: Record<string, string> = {
  slate: "bg-slate-400",
  sky: "bg-sky-400",
  emerald: "bg-emerald-400",
  violet: "bg-violet-400",
  rose: "bg-rose-400",
};

export function PlannerWeek({
  weekStart,
  today,
  days,
  weeklyComment,
  readOnly,
}: {
  weekStart: string;
  today: string;
  days: PlannerDay[];
  weeklyComment: string | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  // △를 고른 과제의 사유 입력창을 열어둔다
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");

  // 인증사진 — 파일 input은 하나만 두고 어느 과제에 붙일지 ref로 들고 있는다
  const fileRef = useRef<HTMLInputElement>(null);
  const photoForRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const taskById = new Map(
    days.flatMap((d) =>
      d.blocks.flatMap((b) => b.tasks.map((t) => [t.id, t] as const)),
    ),
  );

  const goWeek = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", next);
    router.push(`/dashboard/planner?${params.toString()}`);
  };

  const check = (
    taskId: string,
    status: PlannerCheckStatus,
    lateReason?: string | null,
  ) => {
    setMessage(null);
    startTransition(async () => {
      const res = await submitPlannerChecksAction([
        { task_id: taskId, status, late_reason: lateReason ?? null },
      ]);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message });
        return;
      }
      setReasonFor(null);
      setReasonText("");
      setMessage({ kind: "ok", text: "체크했어요" });
      router.refresh();
    });
  };

  /** 사진 고르기 → 파일 input 열기. 어느 과제에 붙일지는 photoFor에 기억해둔다 */
  const pickPhoto = (taskId: string) => {
    setMessage(null);
    photoForRef.current = taskId;
    fileRef.current?.click();
  };

  const onPhotoPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 같은 파일을 다시 골라도 change가 뜨게 비워둔다
    event.target.value = "";
    const taskId = photoForRef.current;
    photoForRef.current = null;
    if (!file || !taskId) return;

    const task = taskById.get(taskId);
    if (!task) return;

    setUploading(true);
    startTransition(async () => {
      try {
        // 폰 원본은 5~10MB — 버킷 제한(5MiB)에 걸리므로 올리기 전에 줄인다
        const blob = await resizeImageToJpeg(file);
        const fd = new FormData();
        fd.set("file", new File([blob], "proof.jpg", { type: "image/jpeg" }));

        const up = await uploadPlannerProofAction(fd);
        if (!up.ok) {
          setMessage({ kind: "error", text: up.message });
          return;
        }

        // 사진을 올렸다는 건 과제를 했다는 뜻 — 아직 안 눌렀으면 O로 함께 확정.
        // 이미 △면 상태와 사유를 그대로 유지한다.
        const res = await submitPlannerChecksAction([
          {
            task_id: taskId,
            status: task.status ?? "done",
            late_reason: task.status === "late" ? task.late_reason : null,
            photo_path: up.photo_path,
          },
        ]);
        if (!res.ok) {
          setMessage({ kind: "error", text: res.message });
          return;
        }
        setMessage({ kind: "ok", text: "사진을 첨부했어요" });
        router.refresh();
      } catch {
        setMessage({
          kind: "error",
          text: "사진을 불러올 수 없어요. 다른 사진으로 시도해주세요.",
        });
      } finally {
        setUploading(false);
      }
    });
  };

  const onPick = (task: TaskView, status: PlannerCheckStatus) => {
    if (status === "late") {
      // 사유는 선택이지만, 고르는 순간 입력창을 띄워 남기도록 유도
      setReasonFor(task.id);
      setReasonText(task.late_reason ?? "");
      return;
    }
    check(task.id, status);
  };

  const todayDay = days.find((d) => d.date === today);
  const todayTasks = (todayDay?.blocks ?? []).flatMap((b) =>
    b.kind === "korean" ? b.tasks : [],
  );
  const todayDone = todayTasks.filter((t) => t.status !== null).length;

  return (
    <div className="space-y-4">
      {/* 인증사진 선택용 — 과제마다 두지 않고 하나를 공유한다 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPhotoPicked}
      />

      {/* 주 이동 */}
      <div className="border-hairline bg-surface flex items-center justify-between rounded-[14px] border px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goWeek(addDaysIso(weekStart, -7))}
          aria-label="이전 주"
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm font-bold">
          {shortDayLabel(weekStart)} ~ {shortDayLabel(addDaysIso(weekStart, 6))}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goWeek(addDaysIso(weekStart, 7))}
          aria-label="다음 주"
        >
          <ChevronRight />
        </Button>
      </div>

      {!readOnly && todayTasks.length > 0 && (
        <div className="border-hairline bg-surface rounded-[14px] border p-4">
          <p className="text-sm">
            오늘 국어 과제{" "}
            <span className="font-bold">
              {todayDone}/{todayTasks.length}
            </span>{" "}
            체크했어요.
            {todayDone < todayTasks.length && (
              <span className="text-muted-foreground">
                {" "}
                밤 12시까지 입력할 수 있어요.
              </span>
            )}
          </p>
        </div>
      )}

      {uploading && (
        <Alert>
          <AlertDescription>사진을 올리고 있어요…</AlertDescription>
        </Alert>
      )}

      {message && !uploading && (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* 요일별 카드 — 모바일 우선 */}
      <div className="space-y-3">
        {days.map((day) => {
          const isToday = day.date === today;
          const isPast = day.date < today;
          const isFuture = day.date > today;
          if (day.blocks.length === 0) return null;

          return (
            <section
              key={day.date}
              className={cn(
                "border-hairline bg-surface rounded-[14px] border p-4",
                isToday && "border-primary ring-primary/20 ring-2",
              )}
            >
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-bold">
                  {DAY_LABELS[day.day_of_week]}요일
                </h2>
                <span className="text-muted-foreground text-xs">
                  {day.date.slice(5).replace("-", "/")}
                </span>
                {isToday && (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-bold">
                    오늘
                  </span>
                )}
                {isPast && !readOnly && (
                  <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 text-[10px]">
                    <Lock className="size-3" /> 입력 마감
                  </span>
                )}
                {/* 미래 요일도 버튼이 잠기므로 이유를 적어준다 — 라벨이 없으면
                    학생은 왜 안 눌리는지 알 수 없다 */}
                {isFuture && !readOnly && (
                  <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 text-[10px]">
                    <Clock className="size-3" /> 그날 체크할 수 있어요
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {day.blocks.map((block) => (
                  <div
                    key={block.id}
                    className={cn(
                      "rounded-[10px] border p-3",
                      block.kind === "korean"
                        ? "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/40"
                        : "border-hairline bg-muted/30",
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      {block.kind === "fixed" && (
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            FIXED_DOT[block.color ?? "slate"] ??
                              FIXED_DOT.slate,
                          )}
                        />
                      )}
                      <span className="font-bold">
                        {block.kind === "korean" ? "국어" : block.label}
                      </span>
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {minToHHMM(block.start_min)}~{minToHHMM(block.end_min)}
                      </span>
                    </div>

                    {block.memo && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {block.memo}
                      </p>
                    )}

                    {block.kind === "korean" && (
                      <ul className="mt-2 space-y-2">
                        {block.tasks.map((task) => (
                          <li key={task.id} className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              {task.tag_name && (
                                <span className="border-hairline rounded-full border bg-background px-2 py-0.5 text-[10px]">
                                  {task.tag_name}
                                </span>
                              )}
                              <span className="text-sm">{task.title}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {(
                                ["done", "late", "missed"] as PlannerCheckStatus[]
                              ).map((s) => {
                                const active = task.status === s;
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    disabled={
                                      readOnly || !day.editable || pending
                                    }
                                    onClick={() => onPick(task, s)}
                                    aria-label={PLANNER_CHECK_LABEL[s]}
                                    title={PLANNER_CHECK_LABEL[s]}
                                    className={cn(
                                      "size-9 rounded-md border text-sm font-bold transition-colors",
                                      active
                                        ? STATUS_STYLE[s]
                                        : "bg-background hover:bg-muted",
                                      (readOnly || !day.editable) &&
                                        "cursor-not-allowed opacity-60",
                                    )}
                                  >
                                    {PLANNER_CHECK_MARK[s]}
                                  </button>
                                );
                              })}

                              {task.checked_at && (
                                <span className="text-muted-foreground text-[10px]">
                                  {new Date(task.checked_at).toLocaleTimeString(
                                    "ko-KR",
                                    {
                                      timeZone: "Asia/Seoul",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}{" "}
                                  체크
                                </span>
                              )}
                            </div>

                            {task.status === "late" && task.late_reason && (
                              <p className="text-muted-foreground text-xs">
                                사유: {task.late_reason}
                              </p>
                            )}

                            {/* 인증사진 — 붙은 게 있으면 썸네일, 오늘이면 첨부/교체 */}
                            {(task.photo_path ||
                              (day.editable &&
                                !readOnly &&
                                task.status !== "missed")) && (
                              <div className="flex items-center gap-2">
                                {task.photo_path && (
                                  <a
                                    href={proofSrc(task)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="border-hairline block size-14 shrink-0 overflow-hidden rounded-md border"
                                    title="크게 보기"
                                  >
                                    {/* 라우트가 short-TTL signed URL로 302 — next/image 원격 설정이 필요 없다 */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={proofSrc(task)}
                                      alt="인증사진"
                                      loading="lazy"
                                      className="size-full object-cover"
                                    />
                                  </a>
                                )}
                                {day.editable &&
                                  !readOnly &&
                                  task.status !== "missed" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => pickPhoto(task.id)}
                                      disabled={pending || uploading}
                                    >
                                      <Camera className="size-3.5" />
                                      {task.photo_path
                                        ? "사진 바꾸기"
                                        : "사진 첨부"}
                                    </Button>
                                  )}
                              </div>
                            )}

                            {reasonFor === task.id && (
                              <div className="border-hairline space-y-2 rounded-[10px] border bg-background p-2.5">
                                <p className="text-xs font-medium">
                                  제시간에 못한 이유 (선택)
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {LATE_REASON_PRESETS.map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => setReasonText(preset)}
                                      className={cn(
                                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                                        reasonText === preset
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : "hover:bg-muted",
                                      )}
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                </div>
                                <Input
                                  value={reasonText}
                                  onChange={(e) => setReasonText(e.target.value)}
                                  placeholder="직접 입력해도 돼요"
                                  maxLength={200}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setReasonFor(null)}
                                    disabled={pending}
                                  >
                                    취소
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="flex-1"
                                    onClick={() =>
                                      check(task.id, "late", reasonText)
                                    }
                                    disabled={pending}
                                  >
                                    {pending ? "저장 중…" : "△로 체크"}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {weeklyComment && (
        <div className="border-hairline bg-surface rounded-[14px] border p-4">
          <div className="text-muted-foreground mb-1 text-xs font-bold">
            선생님 주간 총평
          </div>
          <p className="text-sm whitespace-pre-wrap">{weeklyComment}</p>
        </div>
      )}
    </div>
  );
}
