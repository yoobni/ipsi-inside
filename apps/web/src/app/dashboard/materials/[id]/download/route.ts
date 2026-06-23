import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 자료 다운로드 — RLS가 통과시킨 자료만 short-TTL signed URL로 302 redirect.
 * 권한 없는 사용자가 직접 URL을 호출하면 RLS상 row가 안 보여 maybeSingle=null → 403.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: m } = await supabase
    .from("materials")
    .select("id, storage_path, file_name")
    .eq("id", id)
    .maybeSingle();
  if (!m) return new NextResponse("Forbidden or not found", { status: 403 });

  const { data: signed, error } = await supabase.storage
    .from("materials")
    .createSignedUrl(m.storage_path, 60, { download: m.file_name });

  if (error || !signed?.signedUrl) {
    return new NextResponse("Signed URL failed", { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
