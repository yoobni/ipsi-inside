import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type AdminCheck =
  | { ok: true; supabase: ServerSupabase; adminId: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/**
 * 요청 세션이 승인된 원장(admin+approved)인지 확인한다.
 * proxy.ts가 이미 막지만 RLS·프록시만 믿지 않는 방어심층화 — service_role을
 * 쓰는 액션은 반드시 이 확인을 먼저 통과해야 한다.
 */
async function checkAdmin(): Promise<AdminCheck> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" || profile?.status !== "approved") {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, supabase, adminId: user.id };
}

type AdminMessages = { unauthenticated: string; forbidden: string };

const DEFAULT_MESSAGES: AdminMessages = {
  unauthenticated: "로그인이 필요합니다",
  forbidden: "권한이 없습니다",
};

/**
 * 서버 액션용 관리자 확인. 실패하면 액션이 그대로 돌려줄 `{ ok: false }`를 준다.
 * 화면별로 문구가 다른 곳(칼럼·Q&A)은 messages로 넘긴다.
 */
export async function ensureAdmin(
  messages: AdminMessages = DEFAULT_MESSAGES,
): Promise<
  | { supabase: ServerSupabase; adminId: string }
  | { error: { ok: false; message: string } }
> {
  const check = await checkAdmin();
  if (!check.ok) {
    return { error: { ok: false, message: messages[check.reason] } };
  }
  return { supabase: check.supabase, adminId: check.adminId };
}
