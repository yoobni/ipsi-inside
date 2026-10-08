import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { ColumnEditor } from "../column-editor";

export const dynamic = "force-dynamic";

export default async function NewColumnPage() {
  const supabase = await createServerSupabaseClient();
  const { data: categories } = await supabase
    .from("column_categories")
    .select("id, label, archived")
    .eq("archived", false)
    .order("position");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">새 칼럼</h1>
      <ColumnEditor categories={categories ?? []} />
    </div>
  );
}
