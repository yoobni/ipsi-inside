function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`환경 변수 ${name}가 설정되지 않았습니다. .env.local을 확인하세요.`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabaseAnonKey(): string {
  return required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseServiceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * 앱별 Supabase 인증 쿠키 이름. 같은 localhost 도메인에서 web/admin 세션을 분리하기 위해
 * 각 앱이 자기 쿠키 이름을 정해야 함. unset이면 `@supabase/ssr` 기본값 사용 (둘이 충돌함).
 *   - apps/web: NEXT_PUBLIC_SUPABASE_AUTH_COOKIE_NAME=sb-web-auth-token
 *   - apps/admin: NEXT_PUBLIC_SUPABASE_AUTH_COOKIE_NAME=sb-admin-auth-token
 */
export function getSupabaseAuthCookieName(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_AUTH_COOKIE_NAME || undefined;
}

/**
 * Cloudflare Turnstile(캡차) 키 — 둘 다 선택값이다.
 *
 * 미설정이면 캡차 기능이 통째로 꺼진다(위젯 안 뜸, 서버 검증 skip). 로컬 개발과
 * 아직 대시보드 설정 전 단계를 막지 않기 위해서다. 운영에서 켜려면 site/secret을
 * 모두 채우고, **Supabase 대시보드 Auth CAPTCHA도 함께 켜야** anon key로 Auth를
 * 직접 때리는 무차별 대입(보안조사 E-1)까지 막힌다 — 우리 서버 검증만으로는
 * 서버를 우회하는 공격을 못 막는다.
 */
export function getTurnstileSiteKey(): string | undefined {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined;
}

export function getTurnstileSecretKey(): string | undefined {
  return process.env.TURNSTILE_SECRET_KEY || undefined;
}
