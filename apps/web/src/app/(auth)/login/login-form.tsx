"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginAction } from "../actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
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
          aria-invalid={!!fieldErrors?.email}
        />
        {fieldErrors?.email && (
          <p className="text-xs text-primary">{fieldErrors.email[0]}</p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">비밀번호</Label>
          <Link
            href="/forgot-password"
            className="text-muted-foreground text-xs hover:text-foreground hover:underline"
          >
            비밀번호 찾기
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!fieldErrors?.password}
        />
        {fieldErrors?.password && (
          <p className="text-xs text-primary">{fieldErrors.password[0]}</p>
        )}
      </div>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? "로그인 중..." : "로그인 하기"}
      </Button>
    </form>
  );
}
