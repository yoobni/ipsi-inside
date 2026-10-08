import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@ipsi/lib/supabase/middleware";
import { requiredAccessForPath, staffCanAccess, type PermissionKey } from "@ipsi/types";

/**
 * 어드민 앱 권한 정책:
 *   - admin role + status='approved' + admin_level 있는 세션만 통과
 *   - 그 외 세션(학생/학부모/pending/profile 없음)은 즉시 /api/signout
 *   - 임시 비밀번호(must_change_password)면 /account/password 로 묶어둔다
 *   - 조교는 라우트 규칙(@ipsi/types ADMIN_ROUTE_RULES)에 따라 허용된 메뉴만.
 *     원장 전용·권한 없는 메뉴로 직접 URL을 치면 /forbidden
 *   - /login, /api/signout, 정적 자산만 비로그인 허용
 *
 * 이건 낙관적 1차 방어다. 서버 액션은 ensureStaff/ensureOwner로, DB는 RLS로
 * 각자 다시 확인한다 — proxy만 믿지 않는다.
 */
// robots.txt는 세션 없는 크롤러가 부른다 — 리다이렉트되면 "전부 차단" 규칙이 전달되지 않는다
const ALLOW_THROUGH_PREFIXES = [
  "/_next",
  "/favicon",
  "/icon",
  "/apple-icon",
  "/robots.txt",
  "/api/signout",
  "/api/health",
  // Vercel Cron — 세션 없이 들어오고 라우트 안에서 CRON_SECRET 검증
  "/api/cron",
];

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
    .select("role, status, admin_level, must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  const isApprovedStaff =
    profile?.role === "admin" &&
    profile?.status === "approved" &&
    (profile.admin_level === "owner" || profile.admin_level === "assistant");

  if (!isApprovedStaff) {
    // 학생/학부모가 admin 앱에 세션이 남아있는 경우 → 강제 정리
    const url = request.nextUrl.clone();
    url.pathname = "/api/signout";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 원장이 발급한 임시 비밀번호를 쓰는 중이면 새로 정할 때까지 여기 묶어둔다.
  // (웹의 /dashboard/profile 잠금과 같은 규칙)
  if (profile.must_change_password && !pathname.startsWith("/account/password")) {
    const url = request.nextUrl.clone();
    url.pathname = "/account/password";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isLoginRoute) return response;

  // 조교: 라우트별 권한. 원장은 전부 통과.
  if (profile.admin_level === "assistant") {
    const access = requiredAccessForPath(pathname);
    let permissions: PermissionKey[] = [];
    if (access !== "owner" && access !== "staff") {
      const { data: settings } = await supabase
        .from("staff_settings")
        .select("permissions")
        .eq("staff_id", user.id)
        .maybeSingle();
      permissions = (settings?.permissions ?? []) as PermissionKey[];
    }
    if (!staffCanAccess("assistant", permissions, access)) {
      const url = request.nextUrl.clone();
      url.pathname = "/forbidden";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)",
  ],
};
