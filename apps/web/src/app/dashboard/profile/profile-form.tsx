"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateMyProfileAction } from "./actions";

export type ProfileInitial = {
  role: "student" | "parent";
  full_name: string;
  phone: string;
  school: string | null;
  grade: number | null;
};

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const [state, formAction, pending] = useActionState(
    updateMyProfileAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <section className="border-hairline rounded-[14px] border bg-surface p-6 space-y-4">
        {state?.ok === false && (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        {state?.ok === true && (
          <Alert>
            <AlertDescription>저장됐어요.</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="full_name">이름</Label>
          <Input
            id="full_name"
            name="full_name"
            defaultValue={initial.full_name}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">휴대폰</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={initial.phone}
            placeholder="01012345678"
            required
          />
          <p className="text-muted-foreground text-xs">
            숫자만 입력 (예: 01012345678)
          </p>
        </div>

        {initial.role === "student" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="school">학교 (선택)</Label>
              <Input
                id="school"
                name="school"
                defaultValue={initial.school ?? ""}
                placeholder="○○고등학교"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade">학년 (선택)</Label>
              <select
                id="grade"
                name="grade"
                defaultValue={initial.grade ? String(initial.grade) : ""}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">-</option>
                <option value="1">1학년</option>
                <option value="2">2학년</option>
                <option value="3">3학년</option>
              </select>
            </div>
          </>
        )}
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
