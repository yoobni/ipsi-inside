import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { NewMaterialForm, type GroupOption } from "../new-form";

export const dynamic = "force-dynamic";

export default async function NewMaterialPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: groups }, { data: memberships }] = await Promise.all([
    supabase
      .from("student_groups")
      .select("id, name")
      .eq("archived", false)
      .order("name"),
    supabase.from("group_members").select("group_id"),
  ]);
  const countByGroup = new Map<string, number>();
  (memberships ?? []).forEach((m) =>
    countByGroup.set(m.group_id, (countByGroup.get(m.group_id) ?? 0) + 1),
  );
  const groupOptions: GroupOption[] = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    member_count: countByGroup.get(g.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/materials">
            <ChevronLeft className="size-4" />
            자료 목록
          </Link>
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">새 자료 업로드</h1>
        <p className="text-muted-foreground text-sm">
          PDF (≤30MB)를 올리고 배부 대상을 선택해요. 저장 후 [발행]을 누르면
          알림이 발송돼요.
        </p>
      </div>

      <NewMaterialForm groups={groupOptions} />
    </div>
  );
}
