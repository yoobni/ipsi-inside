"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleHomeworkAction } from "./actions";

/** 숙제 완료 체크 — 낙관적으로 바로 바꾸고, 실패하면 되돌리며 이유를 보여준다. */
export function HomeworkToggle({ itemId, done, title }: { itemId: string; done: boolean; title: string }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !optimistic;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const res = await toggleHomeworkAction(itemId, next);
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <span className="inline-flex shrink-0 flex-col items-end">
      <button
        type="button"
        role="checkbox"
        aria-checked={optimistic}
        aria-label={`${title} ${optimistic ? "완료 해제" : "완료로 표시"}`}
        disabled={pending}
        onClick={toggle}
        className="inline-flex size-9 items-center justify-center rounded-md disabled:opacity-60"
      >
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-[5px] border transition-colors",
            optimistic ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-background",
          )}
        >
          {optimistic && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </button>
      {error && <span className="text-destructive text-[11px]">{error}</span>}
    </span>
  );
}
