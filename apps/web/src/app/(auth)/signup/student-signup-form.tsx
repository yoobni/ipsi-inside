"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { studentSignupAction } from "../actions";
import { ConsentChecks } from "./consent-checks";

type FieldName =
  | "email"
  | "password"
  | "passwordConfirm"
  | "fullName"
  | "phone"
  | "school"
  | "grade"
  | "termsAgreed"
  | "privacyAgreed";

export function StudentSignupForm() {
  const [grade, setGrade] = useState<string>("1");
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
        <div className="space-y-2">
          <Label htmlFor="grade-trigger">학년</Label>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger
              id="grade-trigger"
              aria-invalid={!!fieldErrors?.grade}
              className="w-full"
            >
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1학년</SelectItem>
              <SelectItem value="2">2학년</SelectItem>
              <SelectItem value="3">3학년</SelectItem>
            </SelectContent>
          </Select>
          {/* Server Action에 값 전달 */}
          <input type="hidden" name="grade" value={grade} />
          {fieldErrors?.grade && (
            <p className="text-xs text-primary">{fieldErrors.grade[0]}</p>
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
      <ConsentChecks
        errors={{
          termsAgreed: fieldErrors?.termsAgreed,
          privacyAgreed: fieldErrors?.privacyAgreed,
        }}
      />
      <Button type="submit" disabled={pending} size="lg" className="w-full">
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
      {errors && <p className="text-xs text-primary">{errors[0]}</p>}
    </div>
  );
}
