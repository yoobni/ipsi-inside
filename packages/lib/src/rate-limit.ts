import { createAdminSupabaseClient } from './supabase/admin';

/**
 * 인증 시도 제한 — 「개인정보의 안전성 확보조치 기준」의 접근 통제 요건.
 *
 * 카운터는 Postgres에 있다(`consume_rate_limit`, 마이그레이션 20260825000000).
 * Redis를 따로 두지 않은 이유: 로그인·가입은 분당 수 건이라 왕복 한 번이
 * 문제되지 않고, 운영 대상이 하나 늘면 그만큼 안 돌아가는 날이 생긴다.
 * 증가와 판정이 upsert 한 문장 안에서 끝나므로 동시 요청이 같은 잔여치를
 * 보고 함께 통과하는 창이 없다.
 *
 * 함수 실행 권한은 anon/authenticated에서 회수돼 있다 — 클라이언트가 직접
 * 부를 수 있으면 남의 버킷을 소진시켜 그 사람 로그인을 막을 수 있다.
 * 그래서 service_role로만 호출한다.
 */

export type RateLimitOptions = {
  /** 식별자 — 'login' / 'signup' / 'password-reset' 등 */
  name: string;
  /** 버킷 키 — 보통 IP, 이메일, user_id 등 */
  key: string;
  /** 윈도우 동안 허용 횟수 */
  limit: number;
  /** 윈도우 길이(초) */
  windowSec: number;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export async function checkRateLimit(
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  try {
    const db = createAdminSupabaseClient();
    const { data, error } = await db.rpc('consume_rate_limit', {
      p_bucket: `${opts.name}:${opts.key}`,
      p_limit: opts.limit,
      p_window_sec: opts.windowSec,
    });

    if (error) {
      // 카운터가 죽었다고 로그인을 막으면 장애가 서비스 정지로 번진다.
      // 통과시키되 반드시 남긴다 — 조용히 열리는 게 제일 나쁘다.
      console.error('[rate-limit] 카운터 조회 실패 — 통과시킴', {
        name: opts.name,
        error,
      });
      return { ok: true };
    }

    // rpc가 set-returning function이라 배열로 온다
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.allowed) return { ok: true };

    return { ok: false, retryAfterSec: row.retry_after_sec ?? opts.windowSec };
  } catch (e) {
    console.error('[rate-limit] 예외 — 통과시킴', { name: opts.name, e });
    return { ok: true };
  }
}

/**
 * 만료된 버킷 청소. 실패해도 무시한다 — 부수적인 정리 작업이다.
 * 크론을 하나 더 두는 대신 로그인 경로에서 가끔 부른다.
 */
export async function pruneRateLimitBuckets(): Promise<void> {
  try {
    await createAdminSupabaseClient().rpc('prune_rate_limit_hits');
  } catch {
    // 무시
  }
}

/**
 * server action 안에서 호출자 IP 추출 — Vercel/일반 프록시 환경 모두 커버.
 * RateLimit 키와 접속기록(admin_access_logs)에 함께 쓴다.
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // 첫 번째가 원본 클라이언트
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? 'unknown';
}
