"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteGuideAction, toggleGuidePublishAction } from "./actions";

export function GuideRowActions({ id, title, published }: { id: string; title: string; published: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await toggleGuidePublishAction(id, !published);
            if (!r.ok) alert(r.message);
            router.refresh();
          })
        }
      >
        {published ? "발행 취소" : "발행"}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label="삭제"
        onClick={() => {
          if (!confirm(`"${title}" 가이드를 삭제할까요? 학생 진도도 함께 지워져요.`)) return;
          startTransition(async () => {
            const r = await deleteGuideAction(id);
            if (!r.ok) alert(r.message);
            router.refresh();
          });
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </>
  );
}
