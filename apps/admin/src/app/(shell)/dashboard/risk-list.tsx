"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { RiskRuleKey, RiskStudent } from "@ipsi/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acknowledgeRiskAction } from "./actions";

/**
 * 관리 필요 학생 목록 + "조치했어요"(N일 숨김). 대시보드와 학생 상세가 같이 쓴다.
 */
export function RiskList({ students, compact = false }: { students: RiskStudent[]; compact?: boolean }) {
  if (students.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-6 text-center text-sm">
        지금 관리가 필요한 학생이 없어요. 👍
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {students.map((s) => (
        <li key={s.student_id} className="space-y-2 px-4 py-3">
          {!compact && (
            <Link href={`/members/${s.student_id}`} className="text-sm font-bold hover:underline">
              {s.full_name}
            </Link>
          )}
          <ul className="space-y-1.5">
            {s.flags.map((f) => (
              <FlagRow key={f.key} studentId={s.student_id} ruleKey={f.key as RiskRuleKey} label={f.label} detail={f.detail} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function FlagRow({ studentId, ruleKey, label, detail }: { studentId: string; ruleKey: RiskRuleKey; label: string; detail: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [days, setDays] = useState(14);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ack = () => {
    setError(null);
    startTransition(async () => {
      const r = await acknowledgeRiskAction({ studentId, ruleKey, note: note || null, days });
      if (!r.ok) return setError(r.message);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant="warning">{label}</Badge>
      <span className="text-muted-foreground text-xs">{detail}</span>
      {!open ? (
        <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setOpen(true)}>
          <Check className="size-3.5" />
          조치했어요
        </Button>
      ) : (
        <div className="flex w-full flex-wrap items-center gap-2 pl-1">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="메모 (예: 전화 상담, 다음 주 재점검)"
            className="h-8 flex-1 text-xs"
            maxLength={200}
          />
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs"
            aria-label="숨길 기간"
          >
            {[7, 14, 30].map((n) => (
              <option key={n} value={n}>{n}일 숨김</option>
            ))}
          </select>
          <Button size="sm" className="h-8" onClick={ack} disabled={pending}>
            {pending ? "저장 중" : "기록"}
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(false)}>
            취소
          </Button>
          {error && <p className="text-destructive w-full text-xs">{error}</p>}
        </div>
      )}
    </li>
  );
}
