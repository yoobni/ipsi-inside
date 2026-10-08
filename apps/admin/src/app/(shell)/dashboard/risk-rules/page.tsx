import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RISK_RULE_KEYS, type RiskRuleKey } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { getStaffContext } from "@/lib/auth";
import { RiskRulesForm } from "./risk-rules-form";

export const dynamic = "force-dynamic";

export default async function RiskRulesPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  if (ctx.staff.level !== "owner") redirect("/forbidden");

  const { data: rules } = await ctx.supabase
    .from("risk_rules")
    .select("key, label, description, enabled, threshold, lookback_days")
    .order("position");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard">
          <ChevronLeft className="size-4" />
          업무 현황
        </Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">관리 필요 규칙</h1>
        <p className="text-muted-foreground text-sm">
          조건을 만족하면 학생이 자동으로 &lsquo;관리 필요&rsquo;로 표시돼요. 임계값과 살펴보는 기간을
          학원 운영에 맞게 조정하세요. 끈 규칙은 감지하지 않아요.
        </p>
      </div>
      <RiskRulesForm
        rules={(rules ?? [])
          .filter((r) => (RISK_RULE_KEYS as readonly string[]).includes(r.key))
          .map((r) => ({
            key: r.key as RiskRuleKey,
            label: r.label,
            description: r.description,
            enabled: r.enabled,
            threshold: Number(r.threshold),
            lookbackDays: r.lookback_days,
          }))}
      />
    </div>
  );
}
