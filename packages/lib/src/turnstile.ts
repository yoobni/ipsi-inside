import { getTurnstileSecretKey } from './env';

/**
 * Cloudflare Turnstile 토큰 검증 (보안조사 E-1/E-2).
 *
 * 로그인·가입·비밀번호 재설정 서버 액션이 진입하자마자 부른다. 사람이 위젯을
 * 통과했다는 증거가 없으면 자동화된 무차별 대입·대량 가입을 앞단에서 끊는다.
 *
 * ⚠️ TODO(2026-08-26): 운영 키가 아직 안 붙었다 — 지금은 secret이 없어 항상
 *     통과한다. 연결 절차는 turnstile-widget.tsx 주석 / 외부 보안조사 문서 참조.
 *
 * secret이 없으면 캡차가 꺼진 것으로 보고 통과시킨다(로컬·설정 전 단계).
 * **이건 우리 서버를 거치는 요청에만 적용된다** — anon key로 Supabase Auth를
 * 직접 때리는 경로는 이 함수를 지나지 않으므로, 운영에서는 Supabase 대시보드
 * Auth CAPTCHA를 함께 켜야 한다.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const secret = getTurnstileSecretKey();
  if (!secret) return { ok: true }; // 캡차 미설정 = 기능 꺼짐

  if (!token) {
    return { ok: false, message: '사람인지 확인이 필요해요. 잠시 후 다시 시도해주세요.' };
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp);

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body },
    );
    const data = (await res.json()) as { success?: boolean };
    if (data.success) return { ok: true };
    return { ok: false, message: '사람인지 확인에 실패했어요. 다시 시도해주세요.' };
  } catch {
    // Cloudflare가 안 뜨면 로그인을 통째로 막는 것보다는 통과시키되(가용성),
    // rate limit과 Supabase 측 캡차가 뒤를 받친다.
    console.error('[turnstile] siteverify 호출 실패 — 통과시킴');
    return { ok: true };
  }
}
