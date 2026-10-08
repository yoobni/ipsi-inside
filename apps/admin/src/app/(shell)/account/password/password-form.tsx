"use client";

import { useActionState } from "react";
import { PASSWORD_RULE_TEXT } from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeStaffPasswordAction } from "./actions";

export function PasswordForm({ mustChange }: { mustChange: boolean }) {
  const [state, formAction, pending] = useActionState(changeStaffPasswordAction, null);

  return (
    <form action={formAction} className="space-y-4 rounded-md border bg-card p-5">
      {mustChange && (
        <Alert>
          <AlertDescription>
            임시 비밀번호로 로그인했어요. 새 비밀번호를 정해야 다른 화면을 쓸 수 있어요.
          </AlertDescription>
        </Alert>
      )}
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="current_password">지금 쓰는 비밀번호</Label>
        <Input id="current_password" name="current_password" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new_password">새 비밀번호</Label>
        <Input id="new_password" name="new_password" type="password" autoComplete="new-password" placeholder={PASSWORD_RULE_TEXT} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm_password">새 비밀번호 확인</Label>
        <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "변경 중..." : "비밀번호 변경"}
        </Button>
      </div>
    </form>
  );
}
