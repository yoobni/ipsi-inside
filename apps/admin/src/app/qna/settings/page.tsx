import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CategoriesEditor, type CategoryRow } from "./categories-editor";

export const dynamic = "force-dynamic";

export default async function QnaSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("qna_categories")
    .select("id, label, placeholder, needs_reference, archived, position")
    .order("position");

  const rows: CategoryRow[] = (data ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    placeholder: c.placeholder,
    needs_reference: c.needs_reference,
    archived: c.archived,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/qna">
          <ChevronLeft className="size-4" />
          Q&amp;A
        </Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">질문 분류 · 가이드라인</h1>
        <p className="text-muted-foreground text-sm">
          학생이 질문할 때 보이는 분류와 안내 문구(가이드라인)를 직접 정해요.
          좋은 예시 문구를 넣어두면 학생이 더 구체적으로 질문해요. &lsquo;교재/문항
          입력 권장&rsquo;을 켜면 그 분류에서 교재·문항 번호 칸이 뜹니다.
        </p>
      </div>
      <CategoriesEditor rows={rows} />
    </div>
  );
}
