"use client";

import { useActionState, useState } from "react";
import { Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { submitJournalAction } from "./actions";

type Props = {
  todayDate: string;
  existing: { content: string; submitted_at: string; updated_at: string } | null;
};

export function JournalSubmit({ todayDate, existing }: Props) {
  const [editing, setEditing] = useState(!existing);
  const [state, formAction, pending] = useActionState(submitJournalAction, null);

  const dateLabel = new Date(todayDate).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  if (!editing && existing) {
    return (
      <section className="border-hairline rounded-[14px] border bg-surface p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs font-medium">
              오늘의 일지 · {dateLabel}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Check className="size-4 text-emerald-500" />
              제출 완료
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" /> 수정
          </Button>
        </div>
        <p className="text-foreground mt-4 whitespace-pre-wrap text-sm leading-relaxed">
          {existing.content}
        </p>
      </section>
    );
  }

  return (
    <section className="border-hairline rounded-[14px] border bg-surface p-6">
      <p className="text-muted-foreground text-xs font-medium">
        오늘의 일지 · {dateLabel}
      </p>
      <h2 className="font-display mt-1 text-xl">오늘 막힌 부분을 적어보세요</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        지문 읽다가 헛다리 짚은 곳, 고민했던 사고 과정 — 원장님이 다음날 피드백을 드려요.
      </p>

      <form action={formAction} className="mt-4 space-y-3">
        {state && !state.ok && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <Textarea
          name="content"
          defaultValue={existing?.content ?? ""}
          placeholder="예) 비문학 지문에서 '논증 구조'가 헷갈렸다. ②번 보기에서 전제-결론 관계로 봤는데 답은 ④번이었다. 왜..."
          rows={6}
          required
        />
        <div className="flex justify-end gap-2">
          {existing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              취소
            </Button>
          )}
          <Button type="submit" disabled={pending} size="default">
            {pending ? "저장 중..." : existing ? "수정 저장" : "제출"}
          </Button>
        </div>
      </form>
    </section>
  );
}
