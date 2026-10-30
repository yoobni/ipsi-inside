"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ackDrillShareAction } from "../../actions";

export function AckButton({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await ackDrillShareAction(attemptId);
            if (!r.ok) setError(r.message);
            else router.refresh();
          })
        }
      >
        <Check className="size-4" />
        확인했어요
      </Button>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
