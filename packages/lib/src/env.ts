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
