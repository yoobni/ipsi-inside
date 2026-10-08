import { cache } from "react";
import { NextResponse } from "next/server";
import {
  STAFF_PERMISSIONS,
  type AdminLevel,
  type PermissionKey,
  type RouteAccess,
  type ScopeMode,
  staffCanAccess,
} from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/** 요청 세션의 교직원 정보. 원장은 권한 전부·범위 all 로 채워 온다. */
export type StaffContext = {
  id: string;
  level: AdminLevel;
  permissions: ReadonlySet<PermissionKey>;
  scopeMode: ScopeMode;
};

type StaffCheck =
  | { ok: true; supabase: ServerSupabase; staff: StaffContext }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/**
 * 세션 → 교직원 컨텍스트. 한 요청 안에서는 한 번만 조회한다(React cache).
 * layout(메뉴)·페이지·서버 액션이 각자 불러도 왕복은 한 번.
 */
const loadStaff = cache(async (): Promise<StaffCheck> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, admin_level")
    .eq("id", user.id)
    .maybeSingle();
  if (
    profile?.role !== "admin" ||
    profile.status !== "approved" ||
    !profile.admin_level
  ) {
    return { ok: false, reason: "forbidden" };
  }

  if (profile.admin_level === "owner") {
    return {
      ok: true,
      supabase,
      staff: {
        id: user.id,
        level: "owner",
        permissions: new Set(STAFF_PERMISSIONS),
        scopeMode: "all",
      },
    };
  }

  // 조교: 설정 행이 없으면 권한 0 · scoped (실패 시 닫힘)
  const { data: settings } = await supabase
    .from("staff_settings")
    .select("permissions, scope_mode")
    .eq("staff_id", user.id)
    .maybeSingle();
  const permissions = new Set(
    (settings?.permissions ?? []).filter((p): p is PermissionKey =>
      (STAFF_PERMISSIONS as readonly string[]).includes(p),
    ),
  );
  return {
    ok: true,
    supabase,
    staff: {
      id: user.id,
      level: "assistant",
      permissions,
      scopeMode: settings?.scope_mode ?? "scoped",
    },
  };
});

/** 서버 컴포넌트용 — 로그인 안 됐거나 교직원이 아니면 null. */
export async function getStaffContext(): Promise<
  { supabase: ServerSupabase; staff: StaffContext } | null
> {
  const check = await loadStaff();
  return check.ok ? { supabase: check.supabase, staff: check.staff } : null;
}

type StaffMessages = {
  unauthenticated: string;
  forbidden: string;
  outOfScope: string;
};

const DEFAULT_MESSAGES: StaffMessages = {
  unauthenticated: "로그인이 필요합니다",
  forbidden: "권한이 없습니다",
  outOfScope: "담당이 아닌 학생이 포함되어 있습니다",
};

export type EnsureStaffOptions = {
  /** 이 메뉴 권한이 있어야 통과(배열이면 전부). 원장은 항상 통과 */
  permission?: PermissionKey | PermissionKey[];
  /** 원장 전용 */
  owner?: boolean;
  /**
   * 건드릴 학생 id들. **세션 클라이언트**로 profiles를 조회해 RLS가 돌려주지 않는
   * id가 있으면 거부한다 — 범위 판단은 DB 정책 한 곳에서만 하고, 여기선 그 결과를
   * service_role로 쓰기 전에 묻는 것뿐이다.
   */
  studentIds?: readonly string[];
  /** 건드릴 그룹 id들(수정·삭제·멤버 관리). scoped 조교는 담당 그룹만 */
  groupIds?: readonly string[];
  messages?: Partial<StaffMessages>;
};

/**
 * 서버 액션용 교직원 확인. 실패하면 액션이 그대로 돌려줄 `{ ok: false }`를 준다.
 *
 * proxy.ts가 라우트 단위로 이미 막지만, 액션은 URL과 무관하게 POST 될 수 있고
 * service_role을 쓰는 액션은 RLS도 안 본다 — 그래서 액션마다 다시 확인한다.
 * `adminId`는 예전 ensureAdmin 호출처(approved_by·updated_by 등)와의 호환용.
 */
export async function ensureStaff(
  opts: EnsureStaffOptions = {},
): Promise<
  | { supabase: ServerSupabase; staff: StaffContext; adminId: string }
  | { error: { ok: false; message: string } }
> {
  const messages = { ...DEFAULT_MESSAGES, ...opts.messages };
  const check = await loadStaff();
  if (!check.ok) {
    return { error: { ok: false, message: messages[check.reason] } };
  }
  const { supabase, staff } = check;

  if (opts.owner && staff.level !== "owner") {
    return { error: { ok: false, message: messages.forbidden } };
  }
  if (opts.permission) {
    const needed = Array.isArray(opts.permission) ? opts.permission : [opts.permission];
    if (!needed.every((p) => staffCanAccess(staff.level, staff.permissions, p))) {
      return { error: { ok: false, message: messages.forbidden } };
    }
  }

  // 원장은 범위 검사가 필요 없다(DB도 is_owner()로 바로 통과).
  if (staff.level === "assistant") {
    const studentIds = [...new Set(opts.studentIds ?? [])];
    if (studentIds.length > 0) {
      // role='student' 로 좁힌다 — 조교의 profiles 읽기 정책은 본인 행과 담당 학생의
      // 학부모도 돌려주므로, 그 id로 마킹·플래너를 쓰는 걸 여기서 막는다.
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .in("id", studentIds);
      const visible = new Set((data ?? []).map((r) => r.id));
      if (studentIds.some((id) => !visible.has(id))) {
        return { error: { ok: false, message: messages.outOfScope } };
      }
    }
    const groupIds = [...new Set(opts.groupIds ?? [])];
    if (groupIds.length > 0 && staff.scopeMode === "scoped") {
      const { data } = await supabase
        .from("staff_group_scope")
        .select("group_id")
        .eq("staff_id", staff.id)
        .in("group_id", groupIds);
      const mine = new Set((data ?? []).map((r) => r.group_id));
      if (groupIds.some((id) => !mine.has(id))) {
        return { error: { ok: false, message: "담당이 아닌 그룹입니다" } };
      }
    }
  }

  return { supabase, staff, adminId: staff.id };
}

/** 원장 전용 액션(가입 승인·회원 계정 조작·조교 관리·접속기록). */
export function ensureOwner(messages?: Partial<StaffMessages>) {
  return ensureStaff({ owner: true, messages });
}

/**
 * Route Handler(CSV 등)용. 실패하면 바로 돌려줄 NextResponse를 준다.
 * 성공 변형에는 supabase가 들어 있으니 그걸로 이어서 조회한다.
 */
export async function requireStaffRoute(
  access: RouteAccess,
): Promise<
  | { supabase: ServerSupabase; staff: StaffContext }
  | { response: NextResponse }
> {
  const check = await loadStaff();
  if (!check.ok) {
    return {
      response: new NextResponse(
        check.reason === "unauthenticated" ? "Unauthorized" : "Forbidden",
        { status: check.reason === "unauthenticated" ? 401 : 403 },
      ),
    };
  }
  if (!staffCanAccess(check.staff.level, check.staff.permissions, access)) {
    return { response: new NextResponse("Forbidden", { status: 403 }) };
  }
  return { supabase: check.supabase, staff: check.staff };
}
