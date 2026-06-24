"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updatePasswordAction } from "../actions";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    null,
  );
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-5">
      {state?.ok === false && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="password">새 비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="영문+숫자 포함 8자 이상"
          required
          aria-invalid={!!fieldErrors?.password}
        />
        {fieldErrors?.password && (
          <p className="text-xs text-primary">{fieldErrors.password[0]}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
        <Input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!fieldErrors?.passwordConfirm}
        />
        {fieldErrors?.passwordConfirm && (
          <p className="text-xs text-primary">{fieldErrors.passwordConfirm[0]}</p>
        )}
      </div>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? "변경 중..." : "비밀번호 변경"}
      </Button>
    </form>
  );
}
