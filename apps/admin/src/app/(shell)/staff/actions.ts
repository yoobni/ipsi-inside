"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  createStaffSchema,
  staffInputSchema,
  type CreateStaffInput,
  type StaffInput,
} from "@ipsi/types";
import { friendlyDbError, logAdminAccess } from "@ipsi/lib";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";
import { ensureOwner } from "@/lib/auth";
import { generateTempPassword } from "@/lib/temp-password";

type Result = { ok: true } | { ok: false; message: string };

/**
 * 조교 계정 수명주기 — 전부 원장 전용, 전부 service_role, 전부 접속기록에 남긴다.
 * 조교에게 어떤 메뉴·어떤 학생을 열어줬는지가 곧 개인정보취급자 지정 기록이다.
 */

/** 대상이 '조교' 프로필인지. 원장 계정은 이 화면에서 못 건드린다(실수 한 번에 어드민 잠김). */
async function loadAssistant(staffId: string) {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from("profiles")
    .select("id, role, status, admin_level, full_name, phone")
    .eq("id", staffId)
    .maybeSingle();
  if (!data || data.role !== "admin") return null;
  if (data.admin_level !== "assistant") return null;
  return data;
}

/** 지정한 학생·그룹 id 중 실제로 존재하는 것만 남긴다(잘못된 id 방어). */
async function validateScopeIds(studentIds: string[], groupIds: string[]) {
  const db = createAdminSupabaseClient();
  const [{ data: students }, { data: groups }] = await Promise.all([
    studentIds.length
      ? db.from("profiles").select("id").eq("role", "student").in("id", studentIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    groupIds.length
      ? db.from("student_groups").select("id").in("id", groupIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  return {
    studentIds: (students ?? []).map((s) => s.id),
    groupIds: (groups ?? []).map((g) => g.id),
  };
}

async function replaceScope(
  staffId: string,
  ownerId: string,
  studentIds: string[],
  groupIds: string[],
) {
  const db = createAdminSupabaseClient();
  // 결과는 "통째로 교체"지만(체크박스 UI와 1:1), 순서는 **추가 → 제거**. 트랜잭션이
  // 없는 두 번의 호출이라, 먼저 지우고 넣다가 실패하면 조교 범위가 통째로 비어
  // 담당 학생 데이터가 전부 닫힌다. 넣고 나서 지우면 실패해도 넓은 쪽에 멈춘다.
  if (studentIds.length > 0) {
    const { error } = await db.from("staff_student_scope").upsert(
      studentIds.map((student_id) => ({ staff_id: staffId, student_id, added_by: ownerId })),
      { onConflict: "staff_id,student_id", ignoreDuplicates: true },
    );
    if (error) return error;
  }
  if (groupIds.length > 0) {
    const { error } = await db.from("staff_group_scope").upsert(
      groupIds.map((group_id) => ({ staff_id: staffId, group_id, added_by: ownerId })),
      { onConflict: "staff_id,group_id", ignoreDuplicates: true },
    );
    if (error) return error;
  }
  {
    let q = db.from("staff_student_scope").delete().eq("staff_id", staffId);
    if (studentIds.length > 0) q = q.not("student_id", "in", `(${studentIds.join(",")})`);
    const { error } = await q;
    if (error) return error;
  }
  {
    let q = db.from("staff_group_scope").delete().eq("staff_id", staffId);
    if (groupIds.length > 0) q = q.not("group_id", "in", `(${groupIds.join(",")})`);
    const { error } = await q;
    if (error) return error;
  }
  return null;
}

export async function createStaffAction(
  input: CreateStaffInput,
): Promise<{ ok: true; id: string; tempPassword: string } | { ok: false; message: string }> {
  const check = await ensureOwner();
  if ("error" in check) return check.error;

  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  }
  const data = parsed.data;
  const db = createAdminSupabaseClient();

  // 임시 비밀번호로 만든다. 원장이 전달하고, 조교가 첫 로그인에서 바꿔야 다른 화면이 열린다.
  const tempPassword = generateTempPassword();
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: data.email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    const message = createErr?.message?.includes("already")
      ? "이미 가입된 이메일입니다"
      : "계정 생성 중 오류가 발생했습니다";
    return { ok: false, message };
  }
  const staffId = created.user.id;
  const nowIso = new Date().toISOString();

  const { error: profileErr } = await db.from("profiles").insert({
    id: staffId,
    role: "admin",
    admin_level: "assistant",
    status: "approved",
    full_name: data.fullName,
    phone: data.phone,
    approved_at: nowIso,
    approved_by: check.adminId,
    must_change_password: true,
  });
  if (profileErr) {
    // 반쪽짜리 계정을 남기지 않는다(웹 가입과 같은 롤백)
    await db.auth.admin.deleteUser(staffId);
    return { ok: false, message: friendlyDbError(profileErr) };
  }

  const { error: settingsErr } = await db.from("staff_settings").insert({
    staff_id: staffId,
    permissions: data.permissions,
    scope_mode: data.scopeMode,
    updated_by: check.adminId,
  });
  if (settingsErr) {
    // 설정 없는 반쪽 계정을 남기지 않는다(auth 삭제 → profiles cascade). 같은 이메일로
    // 다시 시도할 수 있어야 한다.
    await db.auth.admin.deleteUser(staffId);
    return { ok: false, message: friendlyDbError(settingsErr) };
  }

  const scope = await validateScopeIds(data.studentIds, data.groupIds);
  const scopeErr = await replaceScope(staffId, check.adminId, scope.studentIds, scope.groupIds);
  if (scopeErr) {
    await db.auth.admin.deleteUser(staffId);
    return { ok: false, message: friendlyDbError(scopeErr) };
  }

  const h = await headers();
  await logAdminAccess({
    actorId: check.adminId,
    action: "staff.create",
    targetType: "profile",
    targetId: staffId,
    detail: {
      permissions: data.permissions,
      scopeMode: data.scopeMode,
      studentCount: scope.studentIds.length,
      groupCount: scope.groupIds.length,
    },
    headers: h,
  });
  await logAdminAccess({
    actorId: check.adminId,
    action: "staff.password.issue",
    targetType: "profile",
    targetId: staffId,
    headers: h,
  });

  revalidatePath("/staff");
  return { ok: true, id: staffId, tempPassword };
}

export async function updateStaffAction(
  staffId: string,
  input: StaffInput,
): Promise<Result> {
  const check = await ensureOwner();
  if ("error" in check) return check.error;

  const parsed = staffInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  }
  const data = parsed.data;

  const target = await loadAssistant(staffId);
  if (!target) return { ok: false, message: "조교 계정을 찾을 수 없습니다" };

  const db = createAdminSupabaseClient();

  // 변경 전 스냅샷 — 접속기록 detail에 before/after로 남긴다
  const [{ data: beforeSettings }, { data: beforeStudents }, { data: beforeGroups }] =
    await Promise.all([
      db.from("staff_settings").select("permissions, scope_mode").eq("staff_id", staffId).maybeSingle(),
      db.from("staff_student_scope").select("student_id").eq("staff_id", staffId),
      db.from("staff_group_scope").select("group_id").eq("staff_id", staffId),
    ]);

  const { error: profileErr } = await db
    .from("profiles")
    .update({ full_name: data.fullName, phone: data.phone })
    .eq("id", staffId);
  if (profileErr) return { ok: false, message: friendlyDbError(profileErr) };

  const { error: settingsErr } = await db.from("staff_settings").upsert(
    {
      staff_id: staffId,
      permissions: data.permissions,
      scope_mode: data.scopeMode,
      updated_by: check.adminId,
    },
    { onConflict: "staff_id" },
  );
  if (settingsErr) return { ok: false, message: friendlyDbError(settingsErr) };

  const scope = await validateScopeIds(data.studentIds, data.groupIds);
  const scopeErr = await replaceScope(staffId, check.adminId, scope.studentIds, scope.groupIds);
  if (scopeErr) return { ok: false, message: friendlyDbError(scopeErr) };

  await logAdminAccess({
    actorId: check.adminId,
    action: "staff.update",
    targetType: "profile",
    targetId: staffId,
    detail: {
      before: {
        fullName: target.full_name,
        phone: target.phone,
        permissions: beforeSettings?.permissions ?? [],
        scopeMode: beforeSettings?.scope_mode ?? "scoped",
        studentIds: (beforeStudents ?? []).map((s) => s.student_id),
        groupIds: (beforeGroups ?? []).map((g) => g.group_id),
      },
      after: {
        fullName: data.fullName,
        phone: data.phone,
        permissions: data.permissions,
        scopeMode: data.scopeMode,
        studentIds: scope.studentIds,
        groupIds: scope.groupIds,
      },
    },
    headers: await headers(),
  });

  revalidatePath("/staff");
  revalidatePath(`/staff/${staffId}`);
  return { ok: true };
}

/** 비활성화(status=suspended) ↔ 복구. 정지되면 is_admin()이 false라 RLS·proxy가 다음 요청부터 닫힌다. */
export async function setStaffActiveAction(
  staffId: string,
  active: boolean,
): Promise<Result> {
  const check = await ensureOwner();
  if ("error" in check) return check.error;
  if (staffId === check.adminId) {
    return { ok: false, message: "본인 계정은 여기서 바꿀 수 없습니다" };
  }

  const target = await loadAssistant(staffId);
  if (!target) return { ok: false, message: "조교 계정을 찾을 수 없습니다" };

  const { error } = await createAdminSupabaseClient()
    .from("profiles")
    .update({ status: active ? "approved" : "suspended" })
    .eq("id", staffId);
  if (error) return { ok: false, message: friendlyDbError(error) };

  await logAdminAccess({
    actorId: check.adminId,
    action: active ? "staff.reactivate" : "staff.deactivate",
    targetType: "profile",
    targetId: staffId,
    headers: await headers(),
  });

  revalidatePath("/staff");
  revalidatePath(`/staff/${staffId}`);
  return { ok: true };
}

/** 임시 비밀번호 재발급 — 회원 재설정과 같은 규칙(must_change_password 잠금). */
export async function issueStaffTempPasswordAction(
  staffId: string,
): Promise<{ ok: true; tempPassword: string } | { ok: false; message: string }> {
  const check = await ensureOwner();
  if ("error" in check) return check.error;

  const target = await loadAssistant(staffId);
  if (!target) return { ok: false, message: "조교 계정을 찾을 수 없습니다" };

  const db = createAdminSupabaseClient();
  const tempPassword = generateTempPassword();

  const { error: authError } = await db.auth.admin.updateUserById(staffId, {
    password: tempPassword,
  });
  if (authError) return { ok: false, message: authError.message };

  const { error } = await db
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", staffId);
  if (error) return { ok: false, message: friendlyDbError(error) };

  await logAdminAccess({
    actorId: check.adminId,
    action: "staff.password.issue",
    targetType: "profile",
    targetId: staffId,
    headers: await headers(),
  });

  revalidatePath(`/staff/${staffId}`);
  return { ok: true, tempPassword };
}
