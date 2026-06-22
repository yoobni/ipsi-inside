"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Feedback = {
  journal_id: string;
  overall_comment: string | null;
  better_than_yesterday: string | null;
  worse_than_yesterday: string | null;
  must_fix_tomorrow: string | null;
  publish_at: string | null;
};

type DayItem = {
  date: string;
  journalId: string;
  class_question: string | null;
  test_question: string | null;
  message_to_teacher: string | null;
  learning_log: string | null;
  feedback: Feedback | null;
};

type Props = {
  year: number;
  month: number; // 1~12
  items: DayItem[];
  studentChoices: { id: string; full_name: string }[];
  selectedStudentId: string | null;
  viewerRole: "student" | "parent";
};

export function JournalCalendar({
  year,
  month,
  items,
  studentChoices,
  selectedStudentId,
  viewerRole,
}: Props) {
  const router = useRouter();
  const [openDate, setOpenDate] = useState<string | null>(null);

  const itemByDate = useMemo(() => {
    const m = new Map<string, DayItem>();
    items.forEach((i) => m.set(i.date, i));
    return m;
  }, [items]);

  // 달력 그리드 (일~토, 6주)
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstDay.getUTCDay(); // 0=일
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: ({ date: string; day: number } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date, day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = `${year}년 ${month}월`;

  const goMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    const m = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    const params = new URLSearchParams();
    params.set("month", m);
    if (selectedStudentId && viewerRole === "parent") {
      params.set("studentId", selectedStudentId);
    }
    router.push(`/dashboard/journal?${params.toString()}`);
  };

  const onSelectStudent = (sid: string) => {
    const params = new URLSearchParams();
    params.set("month", `${year}-${String(month).padStart(2, "0")}`);
    params.set("studentId", sid);
    router.push(`/dashboard/journal?${params.toString()}`);
  };

  const selectedItem = openDate ? itemByDate.get(openDate) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goMonth(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="font-display text-xl">{monthLabel}</h2>
          <Button variant="outline" size="icon" onClick={() => goMonth(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {viewerRole === "parent" && studentChoices.length > 0 && (
          <Select
            value={selectedStudentId ?? undefined}
            onValueChange={onSelectStudent}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="자녀 선택" />
            </SelectTrigger>
            <SelectContent>
              {studentChoices.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="border-hairline rounded-[14px] border bg-surface overflow-hidden">
        <div className="grid grid-cols-7 border-b text-center text-xs font-medium">
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div
              key={d}
              className={cn(
                "border-hairline py-2",
                i < 6 && "border-r",
                i === 0 && "text-primary",
              )}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, idx) => {
            if (!c) {
              return (
                <div
                  key={idx}
                  className={cn(
                    "border-hairline aspect-square border-b",
                    idx % 7 !== 6 && "border-r",
                  )}
                />
              );
            }
            const item = itemByDate.get(c.date);
            const hasJournal = !!item;
            const hasFeedback = !!item?.feedback;
            return (
              <button
                key={idx}
                type="button"
                disabled={!hasJournal}
                onClick={() => setOpenDate(c.date)}
                className={cn(
                  "border-hairline group relative aspect-square border-b p-2 text-left transition-colors",
                  idx % 7 !== 6 && "border-r",
                  hasJournal
                    ? "hover:bg-primary/5 cursor-pointer"
                    : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    idx % 7 === 0 && "text-primary",
                    !hasJournal && "text-muted-foreground",
                  )}
                >
                  {c.day}
                </span>
                {hasJournal && (
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap gap-0.5">
                    <span className="bg-foreground/60 size-1.5 rounded-full" />
                    {hasFeedback && (
                      <span className="bg-primary size-1.5 rounded-full" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-foreground/60 size-1.5 rounded-full" />
          일지
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary size-1.5 rounded-full" />
          피드백 발행됨
        </span>
      </div>

      {/* 선택 날짜 패널 */}
      {openDate && selectedItem && (
        <DayDetailPanel
          item={selectedItem}
          onClose={() => setOpenDate(null)}
        />
      )}
    </div>
  );
}

function DayDetailPanel({
  item,
  onClose,
}: {
  item: DayItem;
  onClose: () => void;
}) {
  const dateLabel = new Date(item.date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const f = item.feedback;

  return (
    <section className="border-hairline rounded-[14px] border bg-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl">{dateLabel}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="mt-4 space-y-5">
        {/* 학생 일지 — 4갈래 */}
        <div className="space-y-3">
          {(
            [
              ["수업 내용 질문", item.class_question],
              ["시험 내용 질문", item.test_question],
              ["선생님께 전달하고 싶은 것", item.message_to_teacher],
              ["오늘 새로 알게 된 것", item.learning_log],
            ] as const
          )
            .filter(([, v]) => !!v && v.trim().length > 0)
            .map(([label, v]) => (
              <div key={label}>
                <p className="text-muted-foreground text-[11px] font-bold">
                  {label}
                </p>
                <p className="text-foreground mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {v}
                </p>
              </div>
            ))}
        </div>

        {/* 피드백 */}
        {f ? (
          <>
            {f.must_fix_tomorrow && (
              <div className="bg-primary/5 border-primary/30 rounded-[10px] border p-4">
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  내일 반드시 고칠 것
                </p>
                <p className="font-display mt-2 text-xl leading-tight">
                  {f.must_fix_tomorrow}
                </p>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {f.overall_comment && (
                <SubBlock label="종합 코멘트" body={f.overall_comment} />
              )}
              {f.better_than_yesterday && (
                <SubBlock
                  label="어제보다 나아진 점"
                  body={f.better_than_yesterday}
                  tone="positive"
                />
              )}
              {f.worse_than_yesterday && (
                <SubBlock
                  label="어제보다 못한 점"
                  body={f.worse_than_yesterday}
                  tone="negative"
                />
              )}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">아직 피드백이 없어요.</p>
        )}
      </div>
    </section>
  );
}

function SubBlock({
  label,
  body,
  tone,
}: {
  label: string;
  body: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="border-hairline rounded-[10px] border bg-background p-3">
      <p
        className={cn(
          "text-xs font-bold uppercase tracking-wider",
          tone === "positive"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "negative"
              ? "text-primary"
              : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="text-foreground mt-2 whitespace-pre-wrap text-sm leading-relaxed">
        {body}
      </p>
    </div>
  );
}
