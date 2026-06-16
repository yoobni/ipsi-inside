"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parentSignupAction } from "../actions";

type FieldName =
  | "email"
  | "password"
  | "passwordConfirm"
  | "fullName"
  | "phone"
  | "studentFullName"
  | "studentPhone";

export function ParentSignupForm() {
  const [state, formAction, pending] = useActionState(parentSignupAction, null);
  const fieldErrors =
    state && !state.ok
      ? (state.fieldErrors as Partial<Record<FieldName, string[]>>)
      : undefined;

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <h3 className="text-sm font-bold text-foreground">학부모 본인 정보</h3>
        <Field label="이름" name="fullName" autoComplete="name" required errors={fieldErrors?.fullName} />
        <Field
          label="휴대폰 번호"
          name="phone"
          placeholder="010-0000-0000"
          autoComplete="tel"
          required
          errors={fieldErrors?.phone}
        />
        <Field label="이메일" name="email" type="email" autoComplete="email" required errors={fieldErrors?.email} />
        <Field
          label="비밀번호"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="영문+숫자 포함 8자 이상"
          required
          errors={fieldErrors?.password}
        />
        <Field
          label="비밀번호 확인"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          errors={fieldErrors?.passwordConfirm}
        />
      </section>

      <div className="border-t border-hairline pt-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">자녀 매칭 정보</h3>
          <p className="text-xs text-muted-foreground mt-1">
            관리자가 자녀와 학부모 계정을 연결할 때 사용해요.
          </p>
        </div>
        <Field
          label="자녀 이름"
          name="studentFullName"
          required
          errors={fieldErrors?.studentFullName}
        />
        <Field
          label="자녀 휴대폰 번호"
          name="studentPhone"
          placeholder="010-0000-0000"
          required
          errors={fieldErrors?.studentPhone}
        />
      </div>

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? "가입 중..." : "학부모로 가입 신청"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  required,
  errors,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  errors?: string[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={!!errors}
      />
      {errors && <p className="text-xs text-primary">{errors[0]}</p>}
    </div>
  );
}
