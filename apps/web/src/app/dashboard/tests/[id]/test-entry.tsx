"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { startOrResumeAttemptAction } from "../actions";

export function TestEntry({
  testSheetId,
  hasInProgress,
  inProgressId,
  canStart,
  isLocked,
  isClosed,
}: {
  testSheetId: string;
  hasInProgress: boolean;
  inProgressId: string | null;
  canStart: boolean;
  isLocked: boolean;
  isClosed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    setError(null);
    startTransition(async () => {
      const r = await startOrResumeAttemptAction(testSheetId);
      if (r.ok && r.attemptId) {
        router.push(`/dashboard/tests/${testSheetId}/take?attempt=${r.attemptId}`);
      } else if (!r.ok) {
        setError(r.message);
      }
    });
  };

  if (isLocked) {
    return (
      <Alert>
        <AlertDescription>
          아직 시험이 열리지 않았어요. 오픈 시각 이후에 응시 가능합니다.
        </AlertDescription>
      </Alert>
    );
  }
  if (isClosed && !hasInProgress) {
    return (
      <Alert>
        <AlertDescription>이 시험은 마감됐어요.</AlertDescription>
      </Alert>
    );
  }
  if (!canStart && !hasInProgress) {
    return (
      <Alert>
        <AlertDescription>
          더 이상 응시할 수 없어요 (재응시 한도 초과).
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        size="lg"
        onClick={handleStart}
        disabled={pending}
        className="w-full"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            준비 중...
          </>
        ) : hasInProgress ? (
          <>
            <Play className="size-4" />
            이어서 풀기
          </>
        ) : (
          <>
            <Play className="size-4" />
            시험 시작
          </>
        )}
      </Button>
      {hasInProgress && (
        <p className="text-muted-foreground text-center text-xs">
          진행 중인 응시가 있어요. 이어서 풀거나, 완료까지 그대로 진행하세요.
        </p>
      )}
      {/* fallback if missing inProgressId */}
      {!hasInProgress && inProgressId == null && null}
    </div>
  );
}
