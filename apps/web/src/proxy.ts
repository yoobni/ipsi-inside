import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@ipsi/lib/supabase/middleware";

/**
 * Next.js 16: `middleware` → `proxy` 파일 컨벤션.
 *
 * 웹(학생/학부모) 권한 정책:
 *   - admin role 세션 → 즉시 /api/signout (서버에서 cookie 제거 후 /login)
 *   - profiles row 없는 세션 → 동일하게 /api/signout (정합성 어긋난 세션)
 *   - 공개 경로(/, /login, /signup): 누구나 OK
 *   - 보호 경로: 로그인된 학생/학부모만 통과 (status 가드는 페이지에서 /pending으로)
 */
const PUBLIC_PATHS = ["/", "/login", "/signup"];
const ALLOW_THROUGH_PREFIXES = ["/_next", "/favicon", "/api/signout", "/api/health"];

export async function proxy(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (ALLOW_THROUGH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return response;
  }

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup");

  // 비로그인 사용자가 보호 경로 접근 시 → 로그인
  if (!user) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 로그인 사용자: role/status 정합성 확인
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // 프로필이 없거나 admin role이면 → 강제 로그아웃 (웹은 학생/학부모 전용)
  if (!profile || profile.role === "admin") {
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
