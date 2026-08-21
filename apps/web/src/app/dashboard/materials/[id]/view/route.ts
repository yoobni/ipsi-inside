import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";
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

  // signed URL은 service_role로 발급한다.
  //
  // materials 버킷의 storage 정책은 is_admin()만 허용해서, 학생·학부모 세션으로
  // createSignedUrl을 부르면 막히고 500이 났다(자료 배부가 학생 쪽에서 한 번도
  // 동작하지 않던 원인). 스토리지 정책에 audience 규칙을 복제하는 대신 여기서
  // service_role을 쓴다 — 권한 판단은 바로 위 material_files 조회가 이미 끝냈고
  // (materials_audience_read가 발행·예약·만료·audience 5종을 모두 판정한다),
  // storage_path도 그 검증된 행에서 꺼낸 값이라 클라이언트가 지정할 수 없다.
  // 규칙을 두 곳에 두면 이번처럼 한쪽이 잊힌다.
  const { data: signed, error } = await createAdminSupabaseClient()
    .storage.from("materials")
    .createSignedUrl(f.storage_path, 300);
  if (error || !signed?.signedUrl) {
    return new NextResponse("Signed URL failed", { status: 500 });
  }

  await supabase.from("material_downloads").insert({
    material_id: f.material_id,
    user_id: user.id,
    source: "view",
  });

  // 302를 캐시하면 만료된 signed URL을 물고 깨진다
  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
