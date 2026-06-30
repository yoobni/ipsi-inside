import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 인앱 뷰어용 — ?file=<fileId>를 inline signed URL(5분 TTL)로 302.
 * iframe src나 새 탭에서 가리키면 브라우저가 PDF를 그대로 표시.
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
    .select("id, material_id, storage_path")
    .eq("id", fileId)
    .eq("material_id", id)
    .maybeSingle();
  if (!f) return new NextResponse("Forbidden or not found", { status: 403 });

  const { data: signed, error } = await supabase.storage
    .from("materials")
    .createSignedUrl(f.storage_path, 300);
  if (error || !signed?.signedUrl) {
    return new NextResponse("Signed URL failed", { status: 500 });
  }

  await supabase.from("material_downloads").insert({
    material_id: f.material_id,
    user_id: user.id,
    source: "view",
  });

  return NextResponse.redirect(signed.signedUrl, 302);
}
