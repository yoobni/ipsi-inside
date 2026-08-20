"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Camera, MessageSquare, TriangleAlert } from "lucide-react";
import {
  DAY_LABELS,
  PLANNER_CHECK_MARK,
  plannerRate,
  type PlannerWeekStats,
} from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { savePlannerWeeklyCommentAction } from "./actions";

/**
 * 주간 이행 통계 + 주간 총평 입력.
 *
 * 통계는 planner_week_stats RPC가 분자/분모만 주고 비율은 여기서 만든다.
 * 분모 0은 0%가 아니라 '해당 없음'으로 표시해야 한다 — 배정 직후 0%가
 * 뜨면 학생이 안 한 것처럼 보인다.
 */
export function PlannerStats({
  stats,
  weekId,
  weeklyComment,
  weekStatus,
}: {
  stats: PlannerWeekStats | null;
  weekId: string | null;
  weeklyComment: string | null;
  weekStatus: "draft" | "published";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState(weeklyComment ?? "");
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  if (!weekId) return null;

  const dirty = comment.trim() !== (weeklyComment ?? "");

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await savePlannerWeeklyCommentAction({
        week_id: weekId,
        weekly_comment: comment.trim() || null,
      });
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message });
        return;
      }
      setMessage({
        kind: "ok",
        text:
          comment.trim().length === 0
            ? "총평을 지웠어요"
            : weekStatus === "published"
              ? "총평을 저장하고 알렸어요"
              : "총평을 저장했어요 (발행하면 학생에게 보여요)",
      });
      router.refresh();
    });
  };

  const doneRate = stats ? plannerRate(stats.done, stats.due) : null;
  const keptRate = stats ? plannerRate(stats.done + stats.late, stats.due) : null;
  const onTimeRate = stats ? plannerRate(stats.on_time, stats.on_time_base) : null;

  return (
    <div className="space-y-4">
      {stats && stats.total > 0 && (
        <section className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <CalendarCheck className="text-muted-foreground size-4" />
            <div>
              <h2 className="text-sm font-semibold">이번 주 이행 통계</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                국어 과제 {stats.total}개 중 {stats.due}개가 도래했어요
                {stats.total > stats.due &&
                  ` (남은 ${stats.total - stats.due}개는 아직 계산에서 빼요)`}
              </p>
            </div>
          </div>

          <div className="space-y-4 p-4">
            {/* 요약 타일 */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric
                label="완수율 (O)"
                value={fmtRate(doneRate)}
                sub={`${stats.done}/${stats.due}`}
              />
              <Metric
                label="이행률 (O+△)"
                value={fmtRate(keptRate)}
                sub={`${stats.done + stats.late}/${stats.due}`}
              />
              <Metric
                label="시간 준수율"
                value={fmtRate(onTimeRate)}
                sub={`수행 ${stats.on_time_base}건 중 ${stats.on_time}건`}
              />
              <Metric
                label="미입력"
                value={`${stats.unchecked_due}건`}
                sub={
                  stats.unchecked_due > 0
                    ? "지난 날짜는 학생이 못 고쳐요"
                    : "빠짐 없어요"
                }
              />
            </div>

            {/* O/△/X 구성 */}
            <div>
              <p className="mb-1.5 text-xs font-medium">전체 구성</p>
              <StatusBar
                done={stats.done}
                late={stats.late}
                missed={stats.missed}
                unchecked={stats.unchecked_due}
              />
              <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                <Legend className="bg-emerald-500" label={`O ${stats.done}`} />
                <Legend className="bg-amber-500" label={`△ ${stats.late}`} />
                <Legend className="bg-red-500" label={`X ${stats.missed}`} />
                <Legend
                  className="bg-muted-foreground/30"
                  label={`미입력 ${stats.unchecked_due}`}
                />
                {stats.photo_count > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Camera className="size-3" /> 인증사진 {stats.photo_count}장
                  </span>
                )}
              </div>
            </div>

            {/* 태그별 이행률 */}
            {stats.by_tag.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium">영역별 이행률</p>
                <ul className="space-y-2">
                  {stats.by_tag.map((t) => {
                    const kept = t.done + t.late;
                    const rate = plannerRate(kept, t.total);
                    return (
                      <li
                        key={t.tag_id ?? "none"}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span className="w-24 shrink-0 truncate font-medium">
                          {t.name}
                        </span>
                        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                          <div
                            className={cn(
                              "h-2 transition-all",
                              rate === null
                                ? "bg-muted"
                                : rate >= 80
                                  ? "bg-emerald-500"
                                  : rate >= 50
                                    ? "bg-amber-500"
                                    : "bg-red-500",
                            )}
                            style={{ width: `${rate ?? 0}%` }}
                          />
                        </div>
                        <span className="w-24 text-right tabular-nums">
                          {fmtRate(rate)} ({kept}/{t.total})
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* 요일별 */}
            {stats.by_day.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium">요일별</p>
                <div className="flex flex-wrap gap-2">
                  {stats.by_day.map((d) => (
                    <div
                      key={d.date}
                      className="min-w-[68px] rounded-md border bg-background p-2 text-center"
                    >
                      <p className="text-[10px] font-medium">
                        {DAY_LABELS[d.day_of_week]}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums">
                        {d.done + d.late}/{d.total}
                      </p>
                      <div className="mt-1 flex justify-center gap-0.5">
                        {d.done > 0 && (
                          <Pip className="bg-emerald-500" n={d.done} />
                        )}
                        {d.late > 0 && <Pip className="bg-amber-500" n={d.late} />}
                        {d.missed > 0 && <Pip className="bg-red-500" n={d.missed} />}
                        {d.unchecked > 0 && (
                          <Pip
                            className="bg-muted-foreground/30"
                            n={d.unchecked}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* △ 사유 / X 목록 — 상담용 */}
            {(stats.late_reasons.length > 0 || stats.missed_items.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {stats.late_reasons.length > 0 && (
                  <div className="rounded-md border bg-background p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium">
                      <TriangleAlert className="size-3.5 text-amber-500" />
                      {PLANNER_CHECK_MARK.late} 사유 모아보기
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {stats.late_reasons.map((l, i) => (
                        <li key={i} className="text-xs">
                          <span className="text-muted-foreground tabular-nums">
                            {l.date.slice(5).replace("-", "/")}
                          </span>{" "}
                          <span className="font-medium">{l.title}</span>
                          <p className="text-muted-foreground">{l.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {stats.missed_items.length > 0 && (
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-xs font-medium">
                      {PLANNER_CHECK_MARK.missed} 미수행 과제
                    </p>
                    <ul className="mt-2 space-y-1">
                      {stats.missed_items.map((m, i) => (
                        <li key={i} className="text-xs">
                          <span className="text-muted-foreground tabular-nums">
                            {m.date.slice(5).replace("-", "/")}
                          </span>{" "}
                          {m.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 주간 총평 */}
      <section className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <MessageSquare className="text-muted-foreground size-4" />
          <div>
            <h2 className="text-sm font-semibold">주간 총평</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              한 줄이면 충분해요. 저장하면 학생·학부모에게 알림이 갑니다.
            </p>
          </div>
        </div>
        <div className="space-y-2 p-4">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="예) 비문학은 안정적이에요. 문학 분석에서 △가 반복되니 다음 주는 분량을 줄여 매일 1편으로 가요."
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs tabular-nums">
              {comment.length}/1000
            </span>
            <div className="flex gap-2">
              {weeklyComment && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setComment("")}
                  disabled={pending || comment.length === 0}
                >
                  지우기
                </Button>
              )}
              <Button size="sm" onClick={save} disabled={pending || !dirty}>
                {pending ? "저장 중…" : "총평 저장"}
              </Button>
            </div>
          </div>
          {message && (
            <Alert variant={message.kind === "error" ? "destructive" : "default"}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
        </div>
      </section>
    </div>
  );
}

function fmtRate(rate: number | null): string {
  return rate === null ? "—" : `${rate}%`;
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

/** O/△/X/미입력 구성을 한 줄로 — 조각이 0이면 렌더하지 않아 1px 얼룩이 안 생긴다 */
function StatusBar({
  done,
  late,
  missed,
  unchecked,
}: {
  done: number;
  late: number;
  missed: number;
  unchecked: number;
}) {
  const total = done + late + missed + unchecked;
  if (total === 0) {
    return <div className="bg-muted h-2.5 w-full rounded-full" />;
  }
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full">
      {done > 0 && <div className="bg-emerald-500" style={{ width: seg(done) }} />}
      {late > 0 && <div className="bg-amber-500" style={{ width: seg(late) }} />}
      {missed > 0 && <div className="bg-red-500" style={{ width: seg(missed) }} />}
      {unchecked > 0 && (
        <div
          className="bg-muted-foreground/30"
          style={{ width: seg(unchecked) }}
        />
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}

function Pip({ className, n }: { className: string; n: number }) {
  return (
    <span
      className={cn("h-1.5 rounded-full", className)}
      style={{ width: Math.min(n, 4) * 4 }}
    />
  );
}
