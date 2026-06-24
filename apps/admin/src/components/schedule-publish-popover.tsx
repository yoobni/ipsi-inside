"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * 자료/공지 등 광역 fan-out 발행에 공통으로 쓰는 예약 발행 버튼 + sheet.
 * publishAt(ISO) = 그 시점에 가시화. RLS가 published_at <= now() 필터링하므로
 * 미래 시각이어도 그 전엔 학생/학부모에게 안 보이고 알림도 안 뜸.
 */
export function SchedulePublishButton({
  onPublish,
  label = "예약 발행",
  disabled,
}: {
  onPublish: (publishAtIso: string) => Promise<{ ok: boolean; message?: string }>;
  label?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!value) {
      setError("발행 시각을 선택해주세요");
      return;
    }
    const iso = new Date(value).toISOString();
    if (new Date(iso) <= new Date()) {
      setError("미래 시각만 가능합니다. 즉시 발행은 [발행] 버튼을 사용하세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await onPublish(iso);
      if (r.ok) {
        setOpen(false);
        setValue("");
      } else {
        setError(r.message ?? "발행 실패");
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <CalendarClock className="size-3.5" />
        {label}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>예약 발행</SheetTitle>
            <SheetDescription>
              지정한 시각이 되면 자동으로 공개되고 알림이 도착해요.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="publish-at">발행 시각</Label>
              <Input
                id="publish-at"
                type="datetime-local"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                예약 후에도 [내림] 버튼으로 발행 취소 가능합니다.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <SheetFooter className="border-t">
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="flex-1"
              >
                <Send className="size-4" />
                {pending ? "예약 중..." : "예약하기"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
