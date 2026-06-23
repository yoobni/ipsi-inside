import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ipsi/db";
import type { MaterialAudience } from "@ipsi/types";

export type MaterialItem = {
  id: string;
  title: string;
  description: string | null;
  audience: MaterialAudience;
  file_name: string;
  file_size_bytes: number;
  published_at: string | null;
  expires_at: string | null;
};

/**
 * 본인이 받을 수 있는 자료 목록. RLS가 audience/배정/만료를 모두 필터링하므로
 * 클라이언트에선 published 정렬만 적용.
 */
export async function getActiveMaterials(
  supabase: SupabaseClient<Database>,
): Promise<MaterialItem[]> {
  const { data } = await supabase
    .from("materials")
    .select(
      "id, title, description, audience, file_name, file_size_bytes, published_at, expires_at",
    )
    .order("published_at", { ascending: false, nullsFirst: false });
  return (data ?? []) as MaterialItem[];
}
