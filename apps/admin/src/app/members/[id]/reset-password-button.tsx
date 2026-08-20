"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { issueTempPasswordAction } from "../actions";

/**
 * 임시 비밀번호 발급. 발급된 값은 이 화면에서 한 번만 보여준다 —
 * 서버는 해시만 저장하므로 새로고침하면 다시 볼 수 없고, 다시 발급해야 한다.
 */
export function ResetPasswordButton({
  profileId,
  memberName,
}: {
  profileId: string;
  memberName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const issue = () => {
    if (
      !confirm(
        `${memberName} 회원의 비밀번호를 새로 발급할까요?\n기존 비밀번호는 즉시 쓸 수 없게 됩니다.`,
      )
    ) {
      return;
    }
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await issueTempPasswordAction(profileId);
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
      <Button variant="outline" onClick={issue} disabled={pending}>
        <KeyRound className="size-4" />
        {pending ? "발급 중…" : "비밀번호 재설정"}
      </Button>

      {issued && (
        <Alert>
          <AlertDescription className="space-y-2">
            <p className="text-sm">
              임시 비밀번호예요. <b>이 화면에서만 볼 수 있어요</b> — 학생에게
              전달한 뒤 창을 닫으세요.
            </p>
            <div className="flex items-center gap-2">
              <code className="border-hairline bg-background rounded-md border px-2.5 py-1.5 text-base font-bold tracking-wider">
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
            <p className="text-muted-foreground text-xs">
              학생이 이 비밀번호로 로그인하면 새 비밀번호를 정하는 화면이 먼저
              떠요. 바꾸기 전에는 다른 화면을 쓸 수 없어요.
            </p>
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
