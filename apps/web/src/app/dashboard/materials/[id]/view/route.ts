import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 인앱 뷰어용 — Content-Disposition을 attachment로 강제하지 않고 inline.
 * iframe src에서 이 URL을 가리키면 다운로드 라우트와 달리 브라우저가 PDF를 그대로 표시.
 * TTL 5분 (큰 PDF 로드 시간 + iframe 새로고침 여유).
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
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!m) return new NextResponse("Forbidden or not found", { status: 403 });

  const { data: signed, error } = await supabase.storage
    .from("materials")
    .createSignedUrl(m.storage_path, 300);

  if (error || !signed?.signedUrl) {
    return new NextResponse("Signed URL failed", { status: 500 });
  }

  // 인앱 뷰어 진입도 로깅 (source='view')
  await supabase.from("material_downloads").insert({
    material_id: m.id,
    user_id: user.id,
    source: "view",
  });

  return NextResponse.redirect(signed.signedUrl, 302);
}
