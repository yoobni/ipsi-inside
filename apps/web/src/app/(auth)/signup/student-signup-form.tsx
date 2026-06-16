"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { studentSignupAction } from "../actions";

type FieldName =
  | "email"
  | "password"
  | "passwordConfirm"
  | "fullName"
  | "phone"
  | "school"
  | "grade";

export function StudentSignupForm() {
  const [state, formAction, pending] = useActionState(
    studentSignupAction,
    null,
  );
  const fieldErrors =
    state && !state.ok
      ? (state.fieldErrors as Partial<Record<FieldName, string[]>>)
      : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Field label="이름" name="fullName" autoComplete="name" required errors={fieldErrors?.fullName} />
      <Field
        label="휴대폰 번호"
        name="phone"
        placeholder="010-0000-0000"
        autoComplete="tel"
        required
        errors={fieldErrors?.phone}
      />
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="학교명" name="school" placeholder="OO고등학교" required errors={fieldErrors?.school} />
        </div>
        <div>
          <Label htmlFor="grade" className="mb-2">학년</Label>
          <select
            id="grade"
            name="grade"
            required
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            defaultValue="1"
          >
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>
          {fieldErrors?.grade && (
            <p className="text-xs text-destructive mt-1">{fieldErrors.grade[0]}</p>
          )}
        </div>
      </div>
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
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "가입 중..." : "학생으로 가입 신청"}
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
      {errors && <p className="text-xs text-destructive">{errors[0]}</p>}
    </div>
  );
}
