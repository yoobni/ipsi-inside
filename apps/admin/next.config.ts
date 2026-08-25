import path from "node:path";
import type { NextConfig } from "next";

/**
 * 보안 응답 헤더 (보안조사 M-3).
 *
 * Supabase 세션 쿠키는 httpOnly가 아니다 — 브라우저 클라이언트도 같은 쿠키를
 * 읽어야 하는 라이브러리 구조다. 그래서 XSS 한 번이면 세션이 그대로 넘어가고,
 * 클릭재킹·MIME 스니핑 같은 보조 경로를 막는 값이 평소보다 중요하다.
 *
 * script-src는 일부러 넣지 않았다. Next는 RSC 페이로드와 부트스트랩을 인라인
 * 스크립트로 심어서, nonce를 붙이지 않고 strict CSP를 걸면 앱이 그대로 죽는다.
 * 지금 넣은 것들은 그런 부작용이 없는 항목만이다.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // 인증사진 촬영이 있어 camera는 자기 출처에만 남긴다
    value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@ipsi/lib", "@ipsi/db", "@ipsi/types"],
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
