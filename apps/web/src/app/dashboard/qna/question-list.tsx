"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { deleteQuestionAction } from "./actions";

export type QuestionItem = {
  id: string;
  categoryLabel: string | null;
  referenceLabel: string | null;
  questionNo: string | null;
  body: string;
  hasImage: boolean;
  status: "open" | "answered";
  createdAt: string;
  answer: { body: string; publishedAt: string | null } | null;
};

export function QuestionList({ items }: { items: QuestionItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        아직 남긴 질문이 없어요.
      </p>
    );
  }

  const remove = (id: string) => {
    if (!confirm("이 질문을 삭제할까요?")) return;
    startTransition(async () => {
      const res = await deleteQuestionAction(id);
      if (res.ok) router.refresh();
    });
  };

  return (
    <ul className="space-y-3">
      {items.map((q) => (
        <li
          key={q.id}
          className="border-hairline bg-surface space-y-3 rounded-[14px] border p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {q.categoryLabel && (
                <Badge variant="primary">{q.categoryLabel}</Badge>
              )}
              {q.referenceLabel && (
                <span className="text-muted-foreground text-xs">
                  {q.referenceLabel}
                  {q.questionNo ? ` · ${q.questionNo}` : ""}
                </span>
              )}
              {q.hasImage && (
                <span className="text-muted-foreground text-xs">📷 사진</span>
              )}
            </div>
            {q.status === "open" && (
              <button
                type="button"
                onClick={() => remove(q.id)}
                disabled={pending}
                aria-label="삭제"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>

          <p className="text-sm whitespace-pre-wrap">{q.body}</p>

          {q.answer ? (
            <div className="border-primary/30 bg-primary-tint/40 space-y-1 rounded-md border-l-2 py-2 pl-3">
              <p className="text-primary text-xs font-bold">원장님 답변</p>
              <p className="text-sm whitespace-pre-wrap">{q.answer.body}</p>
            </div>
          ) : (
            <Badge variant="outline">답변 대기</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
