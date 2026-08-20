import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 인증사진 열람 — ?task=<taskId>를 signed URL(5분 TTL)로 302.
 * materials 뷰어 라우트와 같은 패턴: 경로를 클라가 지정하지 않고 서버가
 * RLS를 통과한 행에서 꺼낸다(남의 사진 경로를 찍어 넣어도 조회가 비어 403).
 *
 * planner_task_checks 의 select 정책이 '본인 또는 자녀'이므로
 * 학생 본인과 학부모가 그대로 통과한다.
 */
export async function GET(req: Request) {
  const taskId = new URL(req.url).searchParams.get("task");
  if (!taskId) return new NextResponse("task 파라미터 필요", { status: 400 });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: check } = await supabase
    .from("planner_task_checks")
    .select("photo_path")
    .eq("task_id", taskId)
    .maybeSingle();
  if (!check?.photo_path) {
    return new NextResponse("Forbidden or not found", { status: 403 });
  }

  const { data: signed, error } = await supabase.storage
    .from("planner-proofs")
    .createSignedUrl(check.photo_path, 300);
  if (error || !signed?.signedUrl) {
    return new NextResponse("Signed URL failed", { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
