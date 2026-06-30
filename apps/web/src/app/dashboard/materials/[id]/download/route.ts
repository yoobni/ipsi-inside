import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 자료 파일 다운로드 — 묶음(material_files) 중 ?file=<fileId> 하나를 short-TTL signed URL로 302.
 * RLS(material_files_read)가 부모 material 가시성으로 접근을 막음 → 권한 없으면 row=null → 403.
 * 성공 시 material_downloads 행을 source='download'로 insert.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const fileId = new URL(req.url).searchParams.get("file");
  if (!fileId) return new NextResponse("file 파라미터 필요", { status: 400 });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: f } = await supabase
    .from("material_files")
    .select("id, material_id, storage_path, file_name")
    .eq("id", fileId)
    .eq("material_id", id)
    .maybeSingle();
  if (!f) return new NextResponse("Forbidden or not found", { status: 403 });

  const { data: signed, error } = await supabase.storage
    .from("materials")
    .createSignedUrl(f.storage_path, 60, { download: f.file_name });
  if (error || !signed?.signedUrl) {
    return new NextResponse("Signed URL failed", { status: 500 });
  }

  await supabase.from("material_downloads").insert({
    material_id: f.material_id,
    user_id: user.id,
    source: "download",
  });

  return NextResponse.redirect(signed.signedUrl, 302);
}
