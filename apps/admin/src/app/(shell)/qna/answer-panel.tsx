"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveAnswerAction, generateDraftAction } from "./actions";

export function AnswerPanel({
  questionId,
  initialBody = "",
  published,
}: {
  questionId: string;
  initialBody?: string;
  published: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [drafting, setDrafting] = useState(false);

  const save = (publish: boolean) => {
    setError(null);
    setNote(null);
    const fd = new FormData();
    fd.set("questionId", questionId);
    fd.set("body", body);
    fd.set("publish", publish ? "true" : "false");
    startTransition(async () => {
      const res = await saveAnswerAction(null, fd);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setNote(publish ? "발행했어요. 학생에게 보여요." : "초안으로 저장했어요.");
      router.refresh();
    });
  };

  const genDraft = async () => {
    setError(null);
    setNote(null);
    setDrafting(true);
    const res = await generateDraftAction(questionId);
    setDrafting(false);
    if (!res.ok) {
      // 미구현/미연결 안내를 그대로 보여준다
      setNote(res.message);
      return;
    }
    setBody(res.draft);
  };

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {note && (
        <p className="text-muted-foreground text-sm">{note}</p>
      )}

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">답변</label>
        <div className="flex items-center gap-2">
          {/* 이 기능(AI 초안 생성)은 아직 미구현이다 — 어댑터(qna-ai.ts) 자리만
              잡혀 있고, 눌러도 "미연결" 안내만 뜬다. 원장(어드민)에게만 보이는
              배지로 상태를 표시한다. 실제 연동되면 이 배지를 지운다. */}
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            준비 중
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={genDraft}
            disabled={drafting}
            title="아직 준비 중인 기능이에요. 지금은 답변을 직접 작성해주세요."
          >
            <Sparkles className="size-4" />
            {drafting ? "생성 중..." : "AI 초안"}
          </Button>
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        maxLength={8000}
        placeholder="답변을 작성하세요. AI 초안을 받아 다듬어도 됩니다. 발행해야 학생에게 보입니다."
        className="focus-visible:ring-ring w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => save(false)}
          disabled={pending || body.trim().length === 0}
        >
          초안 저장
        </Button>
        <Button
          onClick={() => save(true)}
          disabled={pending || body.trim().length === 0}
        >
          {published ? "다시 발행" : "발행"}
        </Button>
      </div>
    </div>
  );
}
