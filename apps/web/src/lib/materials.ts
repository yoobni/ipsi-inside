import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ipsi/db";
import type { MaterialAudience } from "@ipsi/types";

export type MaterialItem = {
  id: string;
  title: string;
  description: string | null;
  audience: MaterialAudience;
  file_count: number;
  total_bytes: number;
  published_at: string | null;
  expires_at: string | null;
};

/**
 * 본인이 받을 수 있는 자료 목록. RLS가 audience/배정/만료를 모두 필터링하므로
 * 클라이언트에선 published 정렬만 적용. 파일 수/총용량은 material_files에서 집계.
 */
export async function getActiveMaterials(
  supabase: SupabaseClient<Database>,
): Promise<MaterialItem[]> {
  const { data } = await supabase
    .from("materials")
    .select("id, title, description, audience, published_at, expires_at")
    .order("published_at", { ascending: false, nullsFirst: false });
  const materials = data ?? [];
  if (materials.length === 0) return [];

  const { data: files } = await supabase
    .from("material_files")
    .select("material_id, file_size_bytes")
    .in(
      "material_id",
      materials.map((m) => m.id),
    );

  const countByMat = new Map<string, { count: number; bytes: number }>();
  (files ?? []).forEach((f) => {
    const cur = countByMat.get(f.material_id) ?? { count: 0, bytes: 0 };
    cur.count += 1;
    cur.bytes += f.file_size_bytes;
    countByMat.set(f.material_id, cur);
  });

  return materials.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    audience: m.audience as MaterialAudience,
    file_count: countByMat.get(m.id)?.count ?? 0,
    total_bytes: countByMat.get(m.id)?.bytes ?? 0,
    published_at: m.published_at,
    expires_at: m.expires_at,
  }));
}
