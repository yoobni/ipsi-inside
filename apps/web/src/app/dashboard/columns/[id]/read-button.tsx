"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markColumnReadAction } from "../actions";

export function ReadButton({
  columnId,
  alreadyRead,
}: {
  columnId: string;
  alreadyRead: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(alreadyRead);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="text-primary flex items-center justify-center gap-1.5 rounded-[14px] border border-primary/30 bg-primary-tint py-3 text-sm font-bold">
        <Check className="size-4" />
        읽기 완료
      </div>
    );
  }

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await markColumnReadAction(columnId);
          if (res.ok) {
            setDone(true);
            router.refresh();
          }
        })
      }
    >
      {pending ? "처리 중..." : "읽기 완료"}
    </Button>
  );
}
