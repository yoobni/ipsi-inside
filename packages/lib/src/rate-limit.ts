/**
 * Rate limit placeholder — 운영 진입 전 실제 구현으로 교체 필요.
 *
 * ## 현재 상태
 * 모든 호출이 통과(`{ ok: true }`). 외부 의존성 없음.
 *
 * ## 향후 구현 방향 (Upstash Ratelimit 권장)
 * 1. `@upstash/redis` + `@upstash/ratelimit` 추가
 * 2. Upstash 콘솔에서 REST URL/TOKEN 발급 → `.env.local`에 박기
 *    - UPSTASH_REDIS_REST_URL
 *    - UPSTASH_REDIS_REST_TOKEN
 * 3. 이 파일 본체를:
 *    ```ts
 *    import { Ratelimit } from "@upstash/ratelimit";
 *    import { Redis } from "@upstash/redis";
 *    const redis = Redis.fromEnv();
 *    const limiters = new Map<string, Ratelimit>();
 *    function getLimiter(name: string, limit: number, windowSec: number) {
 *      const key = `${name}:${limit}:${windowSec}`;
 *      let rl = limiters.get(key);
 *      if (!rl) {
 *        rl = new Ratelimit({
 *          redis,
 *          limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
 *          analytics: true,
 *          prefix: `ipsi:${name}`,
 *        });
 *        limiters.set(key, rl);
 *      }
 *      return rl;
 *    }
 *    export async function checkRateLimit(...) {
 *      const limiter = getLimiter(opts.name, opts.limit, opts.windowSec);
 *      const { success, remaining, reset } = await limiter.limit(opts.key);
 *      return success ? { ok: true } : { ok: false, retryAfterSec: ... };
 *    }
 *    ```
 *
 * ## 적용 우선순위 (운영 전)
 *  - loginAction: IP당 5회 / 5분, 이메일당 5회 / 5분 — 무차별 시도 방지
 *  - studentSignupAction/parentSignupAction: IP당 3회 / 1시간 — 가입 폭주 방지
 *  - sendPasswordResetAction: 이메일당 3회 / 1시간 — 메일 폭주/사용자 열거 보조 방어
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _opts: RateLimitOptions,
): Promise<RateLimitResult> {
  // TODO: 실제 구현 연결 (위 주석 참조). 현재는 항상 통과.
  return { ok: true };
}

/**
 * server action 안에서 호출자 IP 추출 — Vercel/일반 프록시 환경 모두 커버.
 * RateLimit 키로 사용.
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // 첫 번째가 원본 클라이언트
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    "unknown"
  );
}
