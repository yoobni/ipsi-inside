import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

/**
 * 잘못된 세션(admin role / 프로필 누락 등)을 자동 정리하는 라우트.
 * GET 또는 POST 둘 다 허용 — 프록시가 자동 호출, 로그아웃 버튼도 폼 액션으로 호출 가능.
 */
async function signoutAndRedirect(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  return signoutAndRedirect(request);
}

export async function POST(request: NextRequest) {
  return signoutAndRedirect(request);
}
