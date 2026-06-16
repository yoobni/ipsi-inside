import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@ipsi/lib/supabase/middleware";

/**
 * Next.js 16: `middleware` → `proxy` 파일 컨벤션.
 * 모든 요청 전에 Supabase 세션 새로고침. 보호 경로 가드는 페이지에서 redirect로 처리.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/health");

  if (isPublicAsset) return response;

  // 비로그인 사용자가 보호 경로 접근 시 → 로그인
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 정적 자산 제외:
     * - _next/static, _next/image, favicon
     * - 이미지 파일 (png/jpg/svg/webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)",
  ],
};
