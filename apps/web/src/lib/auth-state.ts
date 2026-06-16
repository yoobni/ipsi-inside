import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ipsi/db";

export type AuthState =
  | { kind: "guest" }
  | { kind: "missing-profile"; userId: string; email: string | null }
  | {
      kind: "admin-on-web";
      userId: string;
      email: string | null;
      fullName: string;
    }
  | {
      kind: "ok";
      userId: string;
      role: "student" | "parent";
      status: "approved" | "pending" | "rejected" | "suspended";
      fullName: string;
      school: string | null;
      grade: number | null;
    };

/**
 * 현재 세션의 "유효 상태"를 한 번에 분류.
 * 가드 로직(redirect 여부)은 각 페이지에서 이 상태를 보고 결정 — 양쪽이 어긋나서 루프 도는 걸 방지.
 */
export async function readAuthState(
  supabase: SupabaseClient<Database>,
): Promise<AuthState> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "guest" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, full_name, school, grade")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { kind: "missing-profile", userId: user.id, email: user.email ?? null };
  }

  if (profile.role === "admin") {
    return {
      kind: "admin-on-web",
      userId: user.id,
      email: user.email ?? null,
      fullName: profile.full_name,
    };
  }

  return {
    kind: "ok",
    userId: user.id,
    role: profile.role,
    status: profile.status,
    fullName: profile.full_name,
    school: profile.school,
    grade: profile.grade,
  };
}
