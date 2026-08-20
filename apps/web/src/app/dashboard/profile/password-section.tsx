"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMyPasswordAction } from "./actions";

/**
 * 비밀번호 변경. mustChange가 true면 원장이 발급한 임시 비밀번호를 쓰는
 * 상태라, 왜 이 화면에 갇혀 있는지 먼저 알려준다.
 */
export function PasswordSection({ mustChange }: { mustChange: boolean }) {
  const [state, formAction, pending] = useActionState(
    changeMyPasswordAction,
    null,
  );

  return (
    <section
      id="password"
      className={cnBox(mustChange)}
    >
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="text-muted-foreground size-4" />
        <h2 className="text-sm font-bold">비밀번호 변경</h2>
      </div>

      {mustChange && !state?.ok && (
        <Alert className="mb-3">
          <AlertDescription>
            선생님이 발급한 임시 비밀번호로 로그인했어요. 새 비밀번호를 정하면
            다른 화면을 쓸 수 있어요.
          </AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="current_password">지금 쓰는 비밀번호</Label>
          <Input
            id="current_password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new_password">새 비밀번호 (8자 이상)</Label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm_password">새 비밀번호 확인</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        {state && !state.ok && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        {state?.ok && (
          <Alert>
            <AlertDescription>비밀번호를 바꿨어요.</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "바꾸는 중…" : "비밀번호 바꾸기"}
        </Button>
      </form>
    </section>
  );
}

function cnBox(highlight: boolean): string {
  return highlight
    ? "border-primary bg-surface rounded-[14px] border p-4"
    : "border-hairline bg-surface rounded-[14px] border p-4";
}
