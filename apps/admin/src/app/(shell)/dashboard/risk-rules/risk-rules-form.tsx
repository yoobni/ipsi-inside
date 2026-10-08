"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RISK_RULE_UNIT, type RiskRuleKey } from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateRiskRulesAction } from "../actions";

type Rule = {
  key: RiskRuleKey;
  label: string;
  description: string;
  enabled: boolean;
  threshold: number;
  lookbackDays: number;
};

export function RiskRulesForm({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(rules);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (key: RiskRuleKey, patch: Partial<Rule>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await updateRiskRulesAction({
        rules: rows.map((x) => ({ key: x.key, enabled: x.enabled, threshold: x.threshold, lookbackDays: x.lookbackDays })),
      });
      setMsg(r.ok ? { ok: true, text: "저장했어요. 다음 조회부터 반영돼요." } : { ok: false, text: r.message });
      if (r.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {msg && (
        <Alert variant={msg.ok ? "default" : "destructive"}>
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className={"rounded-md border bg-card p-4 " + (r.enabled ? "" : "opacity-60")}>
            <div className="flex flex-wrap items-start gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={r.enabled} onChange={(e) => update(r.key, { enabled: e.target.checked })} />
                <span className="text-sm font-bold">{r.label}</span>
              </label>
              <p className="text-muted-foreground w-full text-xs sm:w-auto sm:flex-1">{r.description}</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-20 text-xs">기준</span>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={r.threshold}
                  onChange={(e) => update(r.key, { threshold: Number(e.target.value) })}
                  className="h-8 w-24"
                />
                <span className="text-muted-foreground text-xs">{RISK_RULE_UNIT[r.key]}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-20 text-xs">살펴볼 기간</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={r.lookbackDays}
                  onChange={(e) => update(r.key, { lookbackDays: Number(e.target.value) })}
                  className="h-8 w-24"
                />
                <span className="text-muted-foreground text-xs">일</span>
              </label>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}
