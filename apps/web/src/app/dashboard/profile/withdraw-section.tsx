"use client";

import { useActionState, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { withdrawAction } from "./actions";

export function WithdrawSection() {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(withdrawAction, null);

  return (
    <section className="border-destructive/40 bg-destructive/5 space-y-4 rounded-[14px] border p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <h2 className="text-base font-bold">회원 탈퇴</h2>
          <p className="text-muted-foreground text-sm">
            탈퇴하면 이름·연락처 등 개인정보는 즉시 익명 처리되고, 직접 작성한
            학습 일지는 삭제돼요. 시험 결과·출결 등 학습 이력은 통계 목적으로
            익명 보관됩니다. 동일 이메일로의 재가입은 운영자 도움이 필요해요.
          </p>
        </div>
      </div>

      {!confirming ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirming(true)}
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            탈퇴하기
          </Button>
        </div>
      ) : (
        <form action={formAction} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="withdraw-password">
              비밀번호를 한 번 더 입력해주세요
            </Label>
            <Input
              id="withdraw-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state?.ok === false && (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? "처리 중..." : "정말 탈퇴할게요"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
