"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import type { PracticeTagKind } from "@ipsi/types";
import { createPracticeSetAction } from "./practice-actions";

/** "보충 N문제 풀기" — 성공하면 서버 액션이 시험 상세로 redirect 한다 */
export function PracticeButton({ tagKind, tagId, size }: { tagKind: PracticeTagKind; tagId: string; size: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await createPracticeSetAction({ tagKind, tagId, size });
            if (r && !r.ok) setError(r.message);
          })
        }
        className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold disabled:opacity-60"
      >
        <Sparkles className="size-3.5" />
        {pending ? "만드는 중..." : `보충 ${size}문제 풀기`}
      </button>
      {error && <p className="text-destructive max-w-[16rem] text-right text-[11px]">{error}</p>}
    </div>
  );
}
