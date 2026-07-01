"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Check } from "lucide-react";
import { JOURNAL_FIELDS, type JournalFieldKey } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { submitJournalAction } from "./actions";

export type ExistingJournal = {
  class_question: string | null;
  test_question: string | null;
  message_to_teacher: string | null;
  learning_log: string | null;
  submitted_at: string;
  updated_at: string;
};

type Props = {
  todayDate: string;
  existing: ExistingJournal | null;
};

export function JournalSubmit({ todayDate, existing }: Props) {
  const hasExisting = hasAnyContent(existing);
  const [editing, setEditing] = useState(!hasExisting);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [state, formAction, pending] = useActionState(submitJournalAction, null);

  // 제출 성공 시 완료 뷰로 전환 + 확인 배너
  useEffect(() => {
    if (state?.ok) {
      setEditing(false);
      setJustSubmitted(true);
    }
  }, [state]);

  const dateLabel = new Date(todayDate).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  // 제출 완료 / 보기 모드
  if (!editing && hasExisting && existing) {
    const filled = JOURNAL_FIELDS.filter(
      (f) => valueOf(existing, f.key)?.trim(),
    );
    return (
      <section className="border-hairline rounded-[14px] border bg-surface p-6">
        {justSubmitted && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Check className="size-4" />
            제출 완료! 원장님이 확인 후 피드백을 드려요.
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs font-medium">
              오늘의 일지 · {dateLabel}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Check className="size-4 text-emerald-500" />
              제출 완료 ({filled.length}/4 항목)
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" /> 수정
          </Button>
        </div>

        <ul className="mt-4 space-y-3">
          {filled.map((f) => (
            <li key={f.key}>
              <p className="text-muted-foreground text-[11px] font-bold">
                {f.label}
              </p>
              <p className="text-foreground mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {valueOf(existing, f.key)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // 입력 모드
  return (
    <section className="border-hairline rounded-[14px] border bg-surface p-6">
      <p className="text-muted-foreground text-xs font-medium">
        오늘의 일지 · {dateLabel}
      </p>
      <h2 className="font-display mt-1 text-xl">오늘은 어떤 생각을 정리해볼까요?</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        4개 항목 중 채우고 싶은 것만 채워도 돼요. 원장님이 다음날 피드백을 드려요.
      </p>

      <form action={formAction} className="mt-4 space-y-4">
        {state && !state.ok && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        {JOURNAL_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <label
              htmlFor={f.key}
              className="text-foreground text-xs font-bold"
            >
              {f.label}
            </label>
            <Textarea
              id={f.key}
              name={f.key}
              defaultValue={existing ? (valueOf(existing, f.key) ?? "") : ""}
              placeholder={f.placeholder}
              rows={3}
            />
          </div>
        ))}

        <div className="flex justify-end gap-2">
          {hasExisting && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(false)}
            >
              취소
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "저장 중..." : hasExisting ? "수정 저장" : "제출"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function hasAnyContent(j: ExistingJournal | null): boolean {
  if (!j) return false;
  return JOURNAL_FIELDS.some((f) => !!valueOf(j, f.key)?.trim());
}

function valueOf(j: ExistingJournal, key: JournalFieldKey): string | null {
  return j[key];
}
