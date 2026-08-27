"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type Result = { ok: true } | { ok: false; message: string };

/**
 * 읽기 완료. 학생 본인만, 발행된 칼럼만(RLS with check가 이중 확인).
 * 이미 눌렀으면 조용히 성공 — 중복 클릭·재방문에 오류를 내지 않는다.
 */
export async function markColumnReadAction(columnId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요해요" };

  const { error } = await supabase
    .from("column_reads")
    .upsert(
      { column_id: columnId, student_id: user.id },
      { onConflict: "column_id,student_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/dashboard/columns");
  revalidatePath(`/dashboard/columns/${columnId}`);
  return { ok: true };
}
