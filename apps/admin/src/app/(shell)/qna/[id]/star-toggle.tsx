"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toggleQuestionStarAction } from "../actions";

/**
 * ★ 좋은 질문 토글. 누르는 즉시 표시를 바꾸고(낙관적), 서버가 거부하면 되돌린다.
 */
export function StarToggle({
  questionId,
  initialStarred,
}: {
  questionId: string;
  initialStarred: boolean;
}) {
  const router = useRouter();
  const [starred, setStarred] = useState(initialStarred);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !starred;
    setStarred(next);
    setError(null);
    startTransition(async () => {
      const res = await toggleQuestionStarAction(questionId, next);
      if (!res.ok) {
        setStarred(!next);
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="ml-auto flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={starred ? "default" : "outline"}
        onClick={toggle}
        disabled={pending}
        aria-pressed={starred}
      >
        <Star className={cn("size-4", starred && "fill-current")} />
        {starred ? "좋은 질문 선정됨" : "좋은 질문으로 선정"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
