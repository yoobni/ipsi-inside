"use client";

import { useActionState, useState } from "react";
import { Megaphone } from "lucide-react";
import { MARKETING_CHANNELS, OPTIONAL_REFUSAL_NOTICE } from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setMarketingConsentAction } from "./actions";

/**
 * 광고성 정보 수신 동의 — 처리방침이 여기서 철회할 수 있다고 약속한 항목.
 *
 * 체크박스를 바꿔도 [저장]을 눌러야 반영된다. 토글 즉시 저장으로 만들면
 * 실수로 스쳐서 동의가 켜지는 일이 생기고, 광고 수신은 그런 실수가
 * 정보통신망법 문제로 번지는 항목이다.
 */
export function MarketingSection({ agreedAt }: { agreedAt: string | null }) {
  const [state, formAction, pending] = useActionState(
    setMarketingConsentAction,
    null,
  );
  const [checked, setChecked] = useState(agreedAt !== null);
  const dirty = checked !== (agreedAt !== null);

  return (
    <section className="border-hairline bg-surface rounded-[14px] border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Megaphone className="text-muted-foreground size-4" />
        <h2 className="text-sm font-bold">광고성 정보 수신</h2>
      </div>

      {state && !state.ok && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state?.ok && !dirty && (
        <Alert className="mb-3">
          <AlertDescription>
            {checked
              ? "수신 동의를 저장했어요."
              : "수신 동의를 철회했어요. 더 이상 광고성 정보를 보내지 않아요."}
          </AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="space-y-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="agreed"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 size-4 accent-current"
          />
          <span>
            학원 이벤트·신규 강의 등 광고성 정보를 받습니다
            <span className="text-muted-foreground mt-0.5 block text-xs">
              전송 수단: {MARKETING_CHANNELS}. {OPTIONAL_REFUSAL_NOTICE}
            </span>
          </span>
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending || !dirty}>
            {pending ? "저장 중..." : "저장"}
          </Button>
          {agreedAt && (
            <p className="text-faint text-xs">
              동의 일시 {new Date(agreedAt).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
