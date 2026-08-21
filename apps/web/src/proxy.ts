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
// 약관·개인정보처리방침은 가입 화면에서 링크하니 비로그인으로도 열려야 한다
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/maintenance",
  "/privacy",
  "/terms",
];
// /api/cron 은 세션 없는 Vercel Cron 호출 — 라우트가 CRON_SECRET을 직접 검증한다
//
// robots.txt/sitemap.xml은 세션이 없는 크롤러가 부르는 경로다. matcher의
// 확장자 예외에 .txt/.xml이 없어서 여기서 빼주지 않으면 /login으로 리다이렉트되고
// SEO 설정이 통째로 죽는다. 아이콘/OG 이미지는 matcher에서 이미 빠지지만
// 목록으로 한 번 더 남겨둔다.
const ALLOW_THROUGH_PREFIXES = [
  "/_next",
  "/favicon",
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  "/robots.txt",
  "/sitemap.xml",
  "/api/signout",
  "/api/health",
  "/api/cron",
];

// 점검 모드(MAINTENANCE_MODE=1)에서도 통과시킬 경로 — 정적 자산/헬스체크/점검 페이지 자체
const MAINTENANCE_ALLOW_PREFIXES = [
  "/_next",
  "/favicon",
  "/api/health",
  "/maintenance",
  // 점검 중에 크롤 규칙까지 503으로 막을 이유는 없다
  "/robots.txt",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 점검 모드: web(학생/학부모)만 차단. admin 앱은 별도라 그대로 열려 있음.
  // 세션 조회(updateSession)보다 먼저 처리해서 점검 중 DB 부하도 피함.
  if (
    process.env.MAINTENANCE_MODE === "1" &&
    !MAINTENANCE_ALLOW_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.rewrite(new URL("/maintenance", request.url), {
      status: 503,
      headers: { "Retry-After": "3600" },
    });
  }

  const { response, supabase, user } = await updateSession(request);

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
    .select("role, must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  // 프로필이 없거나 admin role이면 → 강제 로그아웃 (웹은 학생/학부모 전용)
  if (!profile || profile.role === "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/signout";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 원장이 발급한 임시 비밀번호를 쓰는 중이면 새로 정할 때까지 여기 묶어둔다.
  // 원장이 아는 비밀번호로 서비스를 계속 쓰게 두면 안 된다.
  if (profile.must_change_password && pathname !== "/dashboard/profile") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/profile";
    url.search = "";
    url.hash = "password";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)",
  ],
};
