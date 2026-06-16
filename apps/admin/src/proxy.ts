import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@ipsi/lib/supabase/middleware";

/**
 * 어드민 앱 권한 정책:
 *   - admin role + status='approved'만 통과
 *   - 그 외 세션(학생/학부모/pending/profile 없음)은 즉시 /api/signout
 *   - /login, /api/signout, 정적 자산만 비로그인 허용
 */
const ALLOW_THROUGH_PREFIXES = ["/_next", "/favicon", "/api/signout", "/api/health"];

export async function proxy(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (ALLOW_THROUGH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return response;
  }

  const isLoginRoute = pathname.startsWith("/login");

  if (!user) {
    if (isLoginRoute) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 로그인 사용자: 반드시 admin + approved 여야 함
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  const isApprovedAdmin =
    profile?.role === "admin" && profile?.status === "approved";

  if (!isApprovedAdmin) {
    // 학생/학부모가 admin 앱에 세션이 남아있는 경우 → 강제 정리
    const url = request.nextUrl.clone();
    url.pathname = "/api/signout";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)",
  ],
};
