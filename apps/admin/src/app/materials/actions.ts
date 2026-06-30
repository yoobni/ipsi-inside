"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import {
  materialAssignmentSchema,
  materialInputSchema,
  materialUpdateSchema,
  type MaterialAudience,
} from "@ipsi/types";

type Result =
  | { ok: true; id?: string; count?: number }
  | { ok: false; message: string };

function parseGroupIds(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export async function createMaterialAction(
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const parsed = materialInputSchema.safeParse({
    title: fd.get("title"),
    description: fd.get("description") || null,
    audience: fd.get("audience"),
    expires_at: fd.get("expires_at") || null,
    storage_path: fd.get("storage_path"),
    file_name: fd.get("file_name"),
    file_size_bytes: fd.get("file_size_bytes"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "검증 실패",
    };
  }

  const { data, error } = await supabase
    .from("materials")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      audience: parsed.data.audience,
      expires_at: parsed.data.expires_at ?? null,
      storage_path: parsed.data.storage_path,
      file_name: parsed.data.file_name,
      file_size_bytes: parsed.data.file_size_bytes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    // 업로드는 됐는데 row 생성 실패 → orphan 파일 정리
    await supabase.storage
      .from("materials")
      .remove([parsed.data.storage_path]);
    return { ok: false, message: friendlyDbError(error) };
  }

  // 그룹 대상이면 타깃 그룹 연결
  if (parsed.data.audience === "group") {
    const groupIds = parseGroupIds(fd.get("group_ids"));
    if (groupIds.length > 0) {
      const rows = groupIds.map((gid) => ({
        material_id: data.id,
        group_id: gid,
        added_by: user.id,
      }));
      const { error: gErr } = await supabase
        .from("material_group_targets")
        .insert(rows);
      if (gErr) {
        // 롤백: material row + 업로드 파일 정리
        await supabase.from("materials").delete().eq("id", data.id);
        await supabase.storage
          .from("materials")
          .remove([parsed.data.storage_path]);
        return { ok: false, message: friendlyDbError(gErr) };
      }
    }
  }

  revalidatePath("/materials");
  return { ok: true, id: data.id };
}

export async function updateMaterialAction(
  id: string,
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const parsed = materialUpdateSchema.safeParse({
    title: fd.get("title"),
    description: fd.get("description") || null,
    audience: fd.get("audience"),
    expires_at: fd.get("expires_at") || null,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "검증 실패",
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const { error } = await supabase
    .from("materials")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      audience: parsed.data.audience,
      expires_at: parsed.data.expires_at ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };

  // 그룹 타깃 동기화: group이면 새 목록으로 교체, 아니면 모두 제거.
  await supabase.from("material_group_targets").delete().eq("material_id", id);
  if (parsed.data.audience === "group") {
    const groupIds = parseGroupIds(fd.get("group_ids"));
    if (groupIds.length > 0) {
      const rows = groupIds.map((gid) => ({
        material_id: id,
        group_id: gid,
        added_by: user.id,
      }));
      const { error: gErr } = await supabase
        .from("material_group_targets")
        .insert(rows);
      if (gErr) return { ok: false, message: friendlyDbError(gErr) };
    }
  }

  revalidatePath("/materials");
  revalidatePath(`/materials/${id}`);
  return { ok: true, id };
}

export async function deleteMaterialAction(id: string): Promise<Result> {
  const supabase = await createServerSupabaseClient();

  const { data: m } = await supabase
    .from("materials")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };

  if (m?.storage_path) {
    await supabase.storage.from("materials").remove([m.storage_path]);
  }

  revalidatePath("/materials");
  return { ok: true };
}

export async function togglePublishMaterialAction(
  id: string,
  publish: boolean,
  publishAtIso?: string | null,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();

  const { data: m } = await supabase
    .from("materials")
    .select("title, description, audience")
    .eq("id", id)
    .maybeSingle();
  if (!m) return { ok: false, message: "자료를 찾을 수 없어요." };

  // 발행 시각 결정 — publish=true && publishAtIso 있으면 그 시점, 아니면 now
  const effectivePublishedAt = publish
    ? publishAtIso && publishAtIso.length > 0
      ? new Date(publishAtIso).toISOString()
      : new Date().toISOString()
    : null;

  const { error } = await supabase
    .from("materials")
    .update({
      is_published: publish,
      published_at: effectivePublishedAt,
    })
    .eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };

  // 발행 시 알림 fan-out — 알림 created_at도 publish 시각으로 (미래면 종에 바로 안 뜸)
  if (publish && effectivePublishedAt) {
    await fanOutMaterialNotifications(
      supabase,
      id,
      m.audience as MaterialAudience,
      m.title,
      m.description,
      effectivePublishedAt,
    );
  }

  revalidatePath("/materials");
  revalidatePath(`/materials/${id}`);
  return { ok: true, id };
}

/* ─────────────────────────────────────────────────────────────────────────
 * targeted 배정 (학교 단위 + 개별 학생)
 * ───────────────────────────────────────────────────────────────────────── */

export async function assignMaterialAction(
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const payloadRaw = fd.get("payload");
  if (typeof payloadRaw !== "string")
    return { ok: false, message: "payload 누락" };

  let parsed;
  try {
    parsed = materialAssignmentSchema.parse(JSON.parse(payloadRaw));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "검증 실패" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const { data: material } = await supabase
    .from("materials")
    .select("id, audience, title, description, is_published")
    .eq("id", parsed.material_id)
    .maybeSingle();
  if (!material) return { ok: false, message: "자료를 찾을 수 없어요." };
  if (material.audience !== "targeted") {
    return {
      ok: false,
      message: "핀포인트 배부 모드에서만 학생을 지정할 수 있어요.",
    };
  }

  const targets: { student_id: string; school: string | null }[] = [];

  if ((parsed.schools?.length ?? 0) > 0) {
    const { data: students } = await supabase
      .from("profiles")
      .select("id, school")
      .eq("role", "student")
      .eq("status", "approved")
      .in("school", parsed.schools!);
    (students ?? []).forEach((s) =>
      targets.push({ student_id: s.id, school: s.school }),
    );
  }

  if ((parsed.student_ids?.length ?? 0) > 0) {
    const { data: students } = await supabase
      .from("profiles")
      .select("id, school")
      .in("id", parsed.student_ids!);
    (students ?? []).forEach((s) => {
      if (!targets.find((t) => t.student_id === s.id)) {
        targets.push({ student_id: s.id, school: null });
      }
    });
  }

  if (targets.length === 0)
    return { ok: false, message: "배정 대상 학생이 없어요." };

  const rows = targets.map((t) => ({
    material_id: parsed.material_id,
    student_id: t.student_id,
    assigned_by: user.id,
    assigned_by_school: t.school,
  }));

  // upsert는 ignoreDuplicates라 새로 추가된 학생을 알 수 없음. 사전 조회로 diff 계산.
  const { data: existing } = await supabase
    .from("material_assignments")
    .select("student_id")
    .eq("material_id", parsed.material_id);
  const existingSet = new Set((existing ?? []).map((r) => r.student_id));
  const newlyAssigned = rows
    .map((r) => r.student_id)
    .filter((sid) => !existingSet.has(sid));

  const { error } = await supabase
    .from("material_assignments")
    .upsert(rows, {
      onConflict: "material_id,student_id",
      ignoreDuplicates: true,
    });
  if (error) return { ok: false, message: friendlyDbError(error) };

  // 이미 발행된 자료라면 신규 배정 학생 + 학부모에게도 알림 발사
  if (material.is_published && newlyAssigned.length > 0) {
    // 신규 배정 학생/학부모에게 즉시 알림 (이미 발행된 자료니까 created_at = now)
    const nowIso = new Date().toISOString();
    const notifs: Array<{
      user_id: string;
      type: string;
      title: string;
      body: string | null;
      link: string;
      created_at: string;
    }> = [];
    newlyAssigned.forEach((sid) => {
      notifs.push({
        user_id: sid,
        type: "material_published",
        title: `자료: ${material.title}`,
        body: material.description,
        link: "/dashboard/materials",
        created_at: nowIso,
      });
    });
    const { data: parentLinks } = await supabase
      .from("parent_student_links")
      .select("parent_id")
      .in("student_id", newlyAssigned);
    const parentIds = new Set(
      (parentLinks ?? []).map((l) => l.parent_id),
    );
    parentIds.forEach((pid) => {
      notifs.push({
        user_id: pid,
        type: "material_published",
        title: `자녀에게 자료 배부: ${material.title}`,
        body: material.description,
        link: "/dashboard/materials",
        created_at: nowIso,
      });
    });
    if (notifs.length > 0) {
      await supabase.from("notifications").insert(notifs);
    }
  }

  revalidatePath(`/materials/${parsed.material_id}`);
  return { ok: true, count: rows.length };
}

export async function unassignMaterialAction(
  materialId: string,
  studentId: string,
): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("material_assignments")
    .delete()
    .eq("material_id", materialId)
    .eq("student_id", studentId);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath(`/materials/${materialId}`);
  return { ok: true };
}

/* ─────────────────────────────────────────────────────────────────────────
 * 알림 fan-out (audience 매트릭스)
 * ───────────────────────────────────────────────────────────────────────── */

async function fanOutMaterialNotifications(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  materialId: string,
  audience: MaterialAudience,
  title: string,
  description: string | null,
  createdAtIso: string,
) {
  const recipientIds = new Set<string>();
  const parentTitle = `자녀에게 자료 배부: ${title}`;
  const parentRecipients = new Set<string>();

  if (audience === "all") {
    const { data: users } = await supabase
      .from("profiles")
      .select("id")
      .eq("status", "approved")
      .in("role", ["student", "parent"]);
    (users ?? []).forEach((u) => recipientIds.add(u.id));
  } else if (audience === "student") {
    // 학생 전원 + 자녀가 학생으로 연결된 학부모
    const { data: students } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .eq("status", "approved");
    (students ?? []).forEach((s) => recipientIds.add(s.id));

    const { data: parents } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "parent")
      .eq("status", "approved");
    const approvedParents = new Set((parents ?? []).map((p) => p.id));

    if (approvedParents.size > 0) {
      const { data: links } = await supabase
        .from("parent_student_links")
        .select("parent_id, student_id")
        .in("parent_id", Array.from(approvedParents));
      const studentIdSet = new Set((students ?? []).map((s) => s.id));
      (links ?? []).forEach((l) => {
        if (studentIdSet.has(l.student_id)) {
          parentRecipients.add(l.parent_id);
        }
      });
    }
  } else if (audience === "parent") {
    const { data: parents } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "parent")
      .eq("status", "approved");
    (parents ?? []).forEach((p) => recipientIds.add(p.id));
  } else if (audience === "targeted") {
    const { data: assigns } = await supabase
      .from("material_assignments")
      .select("student_id")
      .eq("material_id", materialId);
    const studentIds = (assigns ?? []).map((a) => a.student_id);
    studentIds.forEach((sid) => recipientIds.add(sid));

    if (studentIds.length > 0) {
      const { data: parentLinks } = await supabase
        .from("parent_student_links")
        .select("parent_id")
        .in("student_id", studentIds);
      (parentLinks ?? []).forEach((l) => parentRecipients.add(l.parent_id));
    }
  } else if (audience === "group") {
    // 타깃 그룹의 현재 멤버(동적) + 그 학부모
    const { data: targets } = await supabase
      .from("material_group_targets")
      .select("group_id")
      .eq("material_id", materialId);
    const groupIds = (targets ?? []).map((t) => t.group_id);

    if (groupIds.length > 0) {
      const { data: members } = await supabase
        .from("group_members")
        .select("student_id")
        .in("group_id", groupIds);
      const studentIds = Array.from(
        new Set((members ?? []).map((m) => m.student_id)),
      );
      studentIds.forEach((sid) => recipientIds.add(sid));

      if (studentIds.length > 0) {
        const { data: parentLinks } = await supabase
          .from("parent_student_links")
          .select("parent_id")
          .in("student_id", studentIds);
        (parentLinks ?? []).forEach((l) => parentRecipients.add(l.parent_id));
      }
    }
  }

  const notifs: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string | null;
    link: string;
    created_at: string;
  }> = [];

  recipientIds.forEach((uid) => {
    notifs.push({
      user_id: uid,
      type: "material_published",
      title: `자료: ${title}`,
      body: description,
      link: "/dashboard/materials",
      created_at: createdAtIso,
    });
  });
  parentRecipients.forEach((pid) => {
    if (recipientIds.has(pid)) return; // 중복 방지
    notifs.push({
      user_id: pid,
      type: "material_published",
      title: parentTitle,
      body: description,
      link: "/dashboard/materials",
      created_at: createdAtIso,
    });
  });

  if (notifs.length > 0) {
    await supabase.from("notifications").insert(notifs);
  }
}
