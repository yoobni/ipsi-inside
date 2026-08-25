import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Supabase 비밀번호 재설정·매직링크 등에서 받은 code를 세션으로 교환.
 * 이메일 링크가 이 경로로 도착 → exchangeCodeForSession → `next` 로 redirect.
 */
/**
 * `next`는 우리 사이트 안의 경로만 허용한다.
 *
 * new URL(next, origin)은 next가 절대 URL이면 origin을 무시한다 —
 * `?next=https://evil.com`도, 프로토콜 상대 경로인 `?next=//evil.com`도
 * 그대로 외부로 나갔다(보안조사 M-1). 로그인 링크를 미끼로 자사 도메인을
 * 거쳐 피싱 사이트로 보내는 데 쓰인다.
 */
function safeNext(raw: string | null): string {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  // 반드시 '/'로 시작하고, '//'나 '/\'(브라우저가 프로토콜 상대로 읽는다)는 거른다
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback", url.origin),
  );
}
