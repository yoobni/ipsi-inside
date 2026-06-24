"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sendPasswordResetAction } from "../actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    sendPasswordResetAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      {state?.ok === false && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state?.ok === true && (
        <Alert>
          <AlertDescription>
            입력하신 이메일로 재설정 링크를 보냈어요. 메일함을 확인해주세요.
            (가입되지 않은 이메일이어도 결과는 동일하게 표시돼요.)
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
        />
      </div>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? "보내는 중..." : "재설정 링크 받기"}
      </Button>
    </form>
  );
}
