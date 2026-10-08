"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, UserMinus, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { issueStaffTempPasswordAction, setStaffActiveAction } from "./actions";

/** 조교 상세 상단 — 비활성화/복구, 임시 비밀번호 재발급. */
export function StaffControls({
  staffId,
  staffName,
  active,
}: {
  staffId: string;
  staffName: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleActive = () => {
    const msg = active
      ? `${staffName} 조교 계정을 비활성화할까요?\n즉시 로그인·접근이 막혀요.`
      : `${staffName} 조교 계정을 다시 활성화할까요?`;
    if (!confirm(msg)) return;
    setError(null);
    startTransition(async () => {
      const res = await setStaffActiveAction(staffId, !active);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  };

  const issue = () => {
    if (!confirm(`${staffName} 조교의 비밀번호를 새로 발급할까요?\n기존 비밀번호는 즉시 쓸 수 없게 됩니다.`)) {
      return;
    }
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await issueStaffTempPasswordAction(staffId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setIssued(res.tempPassword);
    });
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued);
      setCopied(true);
    } catch {
      setError("복사가 막혀 있어요. 직접 선택해 복사해주세요.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={issue} disabled={pending}>
          <KeyRound className="size-4" />
          비밀번호 재발급
        </Button>
        <Button variant={active ? "outline" : "default"} onClick={toggleActive} disabled={pending}>
          {active ? <UserMinus className="size-4" /> : <UserPlus className="size-4" />}
          {active ? "비활성화" : "다시 활성화"}
        </Button>
      </div>

      {issued && (
        <Alert>
          <AlertDescription className="space-y-2">
            <p className="text-sm">
              임시 비밀번호예요. <b>이 화면에서만 볼 수 있어요</b> — 조교에게 전달한 뒤 창을 닫으세요.
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-background rounded-md border px-2.5 py-1.5 text-base font-bold tracking-wider">
                {issued}
              </code>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? (
                  <>
                    <Check className="size-3.5" /> 복사됨
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" /> 복사
                  </>
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
