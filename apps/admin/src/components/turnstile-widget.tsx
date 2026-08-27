"use client";

import Script from "next/script";

/**
 * Cloudflare Turnstile 위젯 (보안조사 E-1/E-2).
 *
 * ⚠️ TODO(운영 연결 필요, 2026-08-26 기준 미연결):
 *   지금은 코드만 있고 실제로 꺼져 있다(키 미설정). 켜려면 —
 *     1. Cloudflare Turnstile 위젯 발급 → site/secret 키 확보
 *     2. Vercel web·admin 프로젝트 env에 NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY 등록
 *     3. Supabase 대시보드 Auth → CAPTCHA 활성화 + 같은 secret 등록
 *        (이걸 켜야 anon key로 Auth를 직접 때리는 우회 경로까지 막힌다 — E-1)
 *     4. (E-2) 자체 회원가입 불필요하면 Auth → Sign Up 비활성화
 *   자세한 내용은 docs/security-review-external-2026-08-26.md.
 *
 * implicit 모드라 스크립트가 이 div를 찾아 캡차를 그리고, 통과하면 가장 가까운
 * <form> 안에 name="cf-turnstile-response" hidden input을 자동으로 넣는다.
 * 서버 액션은 그 값을 verifyTurnstile로 확인한다.
 *
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY가 없으면 아무것도 그리지 않는다 — 캡차 기능이
 * 꺼진 상태(로컬·설정 전)에서 폼이 그대로 동작하게 한다.
 *
 * 토큰은 1회용이다. 서버 액션이 실패해 같은 화면에서 다시 제출하면 토큰이
 * 소진돼 캡차 재확인이 필요할 수 있다 — 위젯이 만료 시 스스로 갱신한다.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function TurnstileWidget() {
  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
      />
      <div
        className="cf-turnstile"
        data-sitekey={SITE_KEY}
        data-theme="auto"
        data-retry="auto"
      />
    </>
  );
}
