"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyDbError } from "@ipsi/lib";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";
import { ensureStaff } from "@/lib/auth";

type Fail = { ok: false; message: string };
type Result = { ok: true } | Fail;
type CreateResult = { ok: true; id: string } | Fail;

const nameSchema = z.string().trim().min(1, "그룹 이름을 입력해주세요").max(40);

// 아래 액션은 전부 service_role로 쓴다(RLS 우회). 그래서 'groups' 권한과
// 담당 그룹·담당 학생 여부를 ensureStaff에서 먼저 확인한다 — 특히
// addGroupMembersAction의 studentIds 검사는 "범위 밖 학생을 내 그룹에 넣어 담당으로
// 만드는" 범위 확장을 막는 핵심이다(DB 정책도 같은 조건으로 막는다).

export async function createGroupAction(input: {
  name: string;
  color?: string | null;
  description?: string | null;
}): Promise<CreateResult> {
  const check = await ensureStaff({ permission: "groups" });
  if ("error" in check) return check.error;

  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("student_groups")
    .insert({
      name: parsed.data,
      color: input.color ?? null,
      description: input.description?.trim() || null,
      created_by: check.adminId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: friendlyDbError(error) };
  }
  revalidatePath("/groups");
  return { ok: true, id: data.id };
}

export async function updateGroupAction(
  id: string,
  input: { name?: string; color?: string | null; description?: string | null },
): Promise<Result> {
  const check = await ensureStaff({ permission: "groups", groupIds: [id] });
  if ("error" in check) return check.error;

  const patch: {
    name?: string;
    color?: string | null;
    description?: string | null;
  } = {};
  if (input.name !== undefined) {
    const parsed = nameSchema.safeParse(input.name);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }
    patch.name = parsed.data;
  }
  if (input.color !== undefined) patch.color = input.color;
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }

  const db = createAdminSupabaseClient();
  const { error } = await db.from("student_groups").update(patch).eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/groups");
  return { ok: true };
}

export async function archiveGroupAction(
  id: string,
  archived: boolean,
): Promise<Result> {
  const check = await ensureStaff({ permission: "groups", groupIds: [id] });
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();
  const { error } = await db
    .from("student_groups")
    .update({ archived })
    .eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/groups");
  return { ok: true };
}

export async function deleteGroupAction(id: string): Promise<Result> {
  const check = await ensureStaff({ permission: "groups", groupIds: [id] });
  if ("error" in check) return check.error;

  // group_members는 on delete cascade로 함께 삭제됨.
  const db = createAdminSupabaseClient();
  const { error } = await db.from("student_groups").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/groups");
  return { ok: true };
}

export async function addGroupMembersAction(
  groupId: string,
  studentIds: string[],
): Promise<Result> {
  const check = await ensureStaff({
    permission: "groups",
    groupIds: [groupId],
    studentIds,
  });
  if ("error" in check) return check.error;
  if (studentIds.length === 0) return { ok: true };

  const db = createAdminSupabaseClient();

  // 학생(role='student')만 담는다 — 잘못된 id 방어.
  const { data: students } = await db
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .in("id", studentIds);
  const validIds = (students ?? []).map((s) => s.id);
  if (validIds.length === 0) {
    return { ok: false, message: "추가할 학생이 없습니다" };
  }

  const rows = validIds.map((studentId) => ({
    group_id: groupId,
    student_id: studentId,
    added_by: check.adminId,
  }));

  // 이미 속한 학생은 무시(중복 PK).
  const { error } = await db
    .from("group_members")
    .upsert(rows, { onConflict: "group_id,student_id", ignoreDuplicates: true });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/groups");
  return { ok: true };
}

export async function removeGroupMemberAction(
  groupId: string,
  studentId: string,
): Promise<Result> {
  const check = await ensureStaff({
    permission: "groups",
    groupIds: [groupId],
    studentIds: [studentId],
  });
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();
  const { error } = await db
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("student_id", studentId);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/groups");
  return { ok: true };
}
