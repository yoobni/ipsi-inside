import type { Metadata } from "next";

/**
 * 사이트 기본 정보 — 메타데이터/robots/sitemap이 공유한다.
 *
 * SITE_URL 결정 순서:
 *   1) NEXT_PUBLIC_SITE_URL — 커스텀 도메인을 붙였을 때 (권장)
 *   2) VERCEL_PROJECT_PRODUCTION_URL — Vercel이 넣어주는 프로덕션 도메인.
 *      프리뷰 배포에서도 프로덕션 도메인을 가리키므로 canonical이 갈라지지 않는다.
 *   3) 로컬 dev 포트
 *
 * 절대 URL이 필요한 곳(og:image, canonical, sitemap)에서만 쓴다.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:1234";
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = "입시인사이드";
export const SITE_TAGLINE = "수능 국어, 안쪽을 본다.";
export const SITE_DESCRIPTION =
  "수능 국어 전문 학원 입시인사이드. 원장이 직접 짠 주간 국어 플래너와 학습 일지, 수능형 시험 자동 채점 리포트, 지문·해설 자료 배부를 한 화면에서. 학부모도 같은 기록을 봅니다.";

/**
 * 로그인 뒤 화면·인증 화면에 붙이는 메타데이터.
 *
 * robots.txt로도 막지만 그건 "요청하지 말라"는 요청일 뿐이고, 링크가 외부에
 * 새면 색인될 수 있다. 세그먼트 layout에 이걸 걸어 페이지 단위로도 막는다.
 * nocache는 이미 색인된 스냅샷 캐시까지 지우라는 뜻.
 */
export const NOINDEX: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};
