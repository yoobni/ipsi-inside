"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { duplicateTestSheetAction } from "../actions";

export function DuplicateButton({ testSheetId }: { testSheetId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await duplicateTestSheetAction(testSheetId);
      if (r.ok && r.id) router.push(`/tests/${r.id}/edit`);
      else if (!r.ok) setError(r.message);
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={pending}
      >
        <Copy className="size-4" />
        {pending ? "복제 중..." : "복제"}
      </Button>
      {error && (
        <span className="text-destructive ml-2 text-xs">{error}</span>
      )}
    </>
  );
}
