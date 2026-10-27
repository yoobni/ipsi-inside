"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  courseDeliverSchema,
  courseSaveSchema,
  courseSessionSaveSchema,
  type CourseDeliverInput,
  type CourseItemInput,
  type CourseSaveInput,
  type CourseSessionSaveInput,
} from "@ipsi/types";
import { friendlyDbError } from "@ipsi/lib";
import { ensureStaff } from "@/lib/auth";

type Result = { ok: true; id: string } | { ok: false; message: string };
type ServerSupabase = Extract<Awaited<ReturnType<typeof ensureStaff>>, { supabase: unknown }>["supabase"];

const uuid = z.string().uuid();

function revalidateCourse(courseId: string) {
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/progress`);
}

/**
 * 반 연결 갱신 — 이 교직원이 **볼 수 있는 반**만 건드린다. scoped 조교가 못 보는 반의 연결은
 * 화면에 안 나오므로, 통째로 지우고 다시 넣으면 남의 반 연결이 조용히 사라진다.
 */
async function syncCourseGroups(supabase: ServerSupabase, courseId: string, groupIds: string[]): Promise<string | null> {
  const { data: visible, error: vErr } = await supabase.from("student_groups").select("id");
  if (vErr) return friendlyDbError(vErr);
  const visibleIds = new Set((visible ?? []).map((g) => g.id));
  if (groupIds.some((id) => !visibleIds.has(id))) return "볼 수 없는 반이 포함되어 있어요";

  const selected = new Set(groupIds);
  const drop = [...visibleIds].filter((id) => !selected.has(id));
  if (drop.length > 0) {
    const { error } = await supabase.from("course_groups").delete().eq("course_id", courseId).in("group_id", drop);
    if (error) return friendlyDbError(error);
  }
  if (groupIds.length > 0) {
    const { error } = await supabase
      .from("course_groups")
      .upsert(groupIds.map((group_id) => ({ course_id: courseId, group_id })), { onConflict: "course_id,group_id", ignoreDuplicates: true });
    if (error) return friendlyDbError(error);
  }
  return null;
}

export async function createCourseAction(input: CourseSaveInput): Promise<Result> {
  const check = await ensureStaff({ permission: "courses" });
  if ("error" in check) return check.error;
  const parsed = courseSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const c = parsed.data;
  const { supabase, adminId } = check;

  const { data, error } = await supabase
    .from("courses")
    .insert({ title: c.title, description: c.description || null, created_by: adminId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: friendlyDbError(error) };

  const gErr = await syncCourseGroups(supabase, data.id, [...new Set(c.groupIds)]);
  if (gErr) return { ok: false, message: gErr };

  revalidateCourse(data.id);
  return { ok: true, id: data.id };
}

export async function updateCourseAction(id: string, input: CourseSaveInput): Promise<Result> {
  const check = await ensureStaff({ permission: "courses" });
  if ("error" in check) return check.error;
  if (!uuid.safeParse(id).success) return { ok: false, message: "잘못된 요청이에요" };
  const parsed = courseSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const c = parsed.data;
  const { supabase } = check;

  const { data, error } = await supabase
    .from("courses")
    .update({ title: c.title, description: c.description || null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: friendlyDbError(error) };
  if (!data) return { ok: false, message: "코스를 찾을 수 없어요" };

  const gErr = await syncCourseGroups(supabase, id, [...new Set(c.groupIds)]);
  if (gErr) return { ok: false, message: gErr };

  revalidateCourse(id);
  return { ok: true, id };
}

export async function archiveCourseAction(id: string, archived: boolean): Promise<Result> {
  const check = await ensureStaff({ permission: "courses" });
  if ("error" in check) return check.error;
  const { error } = await check.supabase.from("courses").update({ archived }).eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidateCourse(id);
  return { ok: true, id };
}

/** 코스 삭제 — 회차·항목·배부 기록·숙제 체크가 함께 지워진다(이미 들어간 자료·시험 배정은 남음). */
export async function deleteCourseAction(id: string): Promise<Result> {
  const check = await ensureStaff({ permission: "courses" });
  if ("error" in check) return check.error;
  const { error } = await check.supabase.from("courses").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/courses");
  return { ok: true, id };
}

// ─── 회차 ──────────────────────────────────────────────────────────────────

export async function addSessionAction(courseId: string, title: string): Promise<Result> {
  const check = await ensureStaff({ permission: "courses" });
  if ("error" in check) return check.error;
  if (!uuid.safeParse(courseId).success) return { ok: false, message: "잘못된 요청이에요" };
  const t = courseSessionSaveSchema.shape.title.safeParse(title);
  if (!t.success) return { ok: false, message: t.error.issues[0]?.message ?? "검증 실패" };
  const { supabase } = check;

  const { data: last } = await supabase
    .from("course_sessions")
    .select("position")
    .eq("course_id", courseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("course_sessions")
    .insert({ course_id: courseId, title: t.data, position: (last?.position ?? 0) + 1 })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: friendlyDbError(error) };
  revalidateCourse(courseId);
  return { ok: true, id: data.id };
}

/** 같은 코스 안에서 바로 위/아래 회차와 자리를 바꾼다. */
export async function moveSessionAction(sessionId: string, dir: "up" | "down"): Promise<Result> {
  const check = await ensureStaff({ permission: "courses" });
  if ("error" in check) return check.error;
  const { supabase } = check;
  const { data: cur } = await supabase.from("course_sessions").select("id, course_id, position").eq("id", sessionId).maybeSingle();
  if (!cur) return { ok: false, message: "회차를 찾을 수 없어요" };

  const base = supabase.from("course_sessions").select("id, position").eq("course_id", cur.course_id);
  const { data: other } = await (dir === "up"
    ? base.lt("position", cur.position).order("position", { ascending: false })
    : base.gt("position", cur.position).order("position", { ascending: true })
  )
    .limit(1)
    .maybeSingle();
  if (!other) return { ok: true, id: sessionId };

  for (const [id, position] of [[cur.id, other.position], [other.id, cur.position]] as const) {
    const { error } = await supabase.from("course_sessions").update({ position }).eq("id", id).eq("course_id", cur.course_id);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  revalidateCourse(cur.course_id);
  return { ok: true, id: sessionId };
}

/** 회차 삭제 — 배부 기록·숙제 체크도 함께 지워진다(이미 들어간 자료·시험 배정은 남음). */
export async function deleteSessionAction(sessionId: string): Promise<Result> {
  const check = await ensureStaff({ permission: "courses" });
  if ("error" in check) return check.error;
  const { supabase } = check;
  const { data: cur } = await supabase.from("course_sessions").select("course_id").eq("id", sessionId).maybeSingle();
  if (!cur) return { ok: false, message: "회차를 찾을 수 없어요" };
  const { error } = await supabase.from("course_sessions").delete().eq("id", sessionId);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidateCourse(cur.course_id);
  return { ok: true, id: sessionId };
}

function itemKey(it: CourseItemInput): string {
  switch (it.kind) {
    case "material": return `material:${it.materialId}`;
    case "test": return `test:${it.testSheetId}`;
    case "drill": return `drill:${it.drillId}`;
    case "guide": return `guide:${it.guideId}`;
    case "homework": return `homework:${it.title}`;
  }
}

type ItemRow = {
  id: string;
  kind: string;
  material_id: string | null;
  test_sheet_id: string | null;
  drill_id: string | null;
  guide_id: string | null;
  title: string | null;
};

function rowKey(r: ItemRow): string {
  if (r.kind === "homework") return `homework:${r.title ?? ""}`;
  return `${r.kind}:${r.material_id ?? r.test_sheet_id ?? r.drill_id ?? r.guide_id}`;
}

/**
 * 회차 저장 — 제목·요약 + 항목 목록 통째 교체(순서 = 배열 순서).
 * 같은 항목(같은 자료·시험지… / 같은 숙제 문구)은 기존 행을 살려 순서만 고친다 — 지웠다 다시
 * 넣으면 학생 숙제 완료 체크가 cascade 로 날아가기 때문. 빠진 항목만 지우고 새 항목만 넣는다.
 * 이미 배부받은 학생에게 새 항목이 소급 배부되지는 않는다.
 */
export async function saveSessionAction(sessionId: string, input: CourseSessionSaveInput): Promise<Result> {
  const check = await ensureStaff({ permission: "courses" });
  if ("error" in check) return check.error;
  const parsed = courseSessionSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const s = parsed.data;
  const { supabase } = check;

  const { data: cur, error: sErr } = await supabase
    .from("course_sessions")
    .update({ title: s.title, summary: s.summary || null })
    .eq("id", sessionId)
    .select("course_id")
    .maybeSingle();
  if (sErr) return { ok: false, message: friendlyDbError(sErr) };
  if (!cur) return { ok: false, message: "회차를 찾을 수 없어요" };

  const { data: existing, error: eErr } = await supabase
    .from("course_session_items")
    .select("id, kind, material_id, test_sheet_id, drill_id, guide_id, title")
    .eq("session_id", sessionId);
  if (eErr) return { ok: false, message: friendlyDbError(eErr) };

  const pool = new Map<string, string[]>();
  for (const r of existing ?? []) pool.set(rowKey(r), [...(pool.get(rowKey(r)) ?? []), r.id]);

  const keep: { id: string; position: number; due_days: number | null }[] = [];
  const inserts: {
    session_id: string;
    position: number;
    kind: CourseItemInput["kind"];
    material_id: string | null;
    test_sheet_id: string | null;
    drill_id: string | null;
    guide_id: string | null;
    title: string | null;
    due_days: number | null;
  }[] = [];
  s.items.forEach((it, i) => {
    const position = i + 1;
    const due_days = it.kind === "homework" ? it.dueDays : null;
    const reuse = pool.get(itemKey(it))?.shift();
    if (reuse) {
      keep.push({ id: reuse, position, due_days });
      return;
    }
    inserts.push({
      session_id: sessionId,
      position,
      kind: it.kind,
      material_id: it.kind === "material" ? it.materialId : null,
      test_sheet_id: it.kind === "test" ? it.testSheetId : null,
      drill_id: it.kind === "drill" ? it.drillId : null,
      guide_id: it.kind === "guide" ? it.guideId : null,
      title: it.kind === "homework" ? it.title : null,
      due_days,
    });
  });

  const drop = [...pool.values()].flat();
  if (drop.length > 0) {
    const { error } = await supabase.from("course_session_items").delete().eq("session_id", sessionId).in("id", drop);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  for (const k of keep) {
    const { error } = await supabase
      .from("course_session_items")
      .update({ position: k.position, due_days: k.due_days })
      .eq("id", k.id)
      .eq("session_id", sessionId);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from("course_session_items").insert(inserts);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  revalidateCourse(cur.course_id);
  return { ok: true, id: sessionId };
}

// ─── 배부 ──────────────────────────────────────────────────────────────────

/**
 * 수업 진행 처리 / 보강 배부. 범위 검사는 앞단(ensureStaff studentIds) + RPC 안 2중.
 * 이미 받은 학생은 RPC가 건너뛴다(멱등) — 돌아온 값 = 새로 배부된 인원.
 */
export async function deliverSessionAction(
  input: CourseDeliverInput,
): Promise<{ ok: true; delivered: number; skipped: number } | { ok: false; message: string }> {
  const parsed = courseDeliverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const d = parsed.data;
  const studentIds = [...new Set(d.studentIds)];
  const check = await ensureStaff({ permission: "courses", studentIds });
  if ("error" in check) return check.error;
  const { supabase } = check;

  const { data: cur } = await supabase.from("course_sessions").select("course_id").eq("id", d.sessionId).maybeSingle();
  if (!cur) return { ok: false, message: "회차를 찾을 수 없어요" };

  const { data, error } = await supabase.rpc("deliver_course_session", {
    p_session_id: d.sessionId,
    p_student_ids: studentIds,
    p_kind: d.kind,
  });
  if (error) {
    // RPC가 던지는 한국어 메시지(범위 밖·인원 초과 등)는 그대로 보여준다
    const message = /[가-힣]/.test(error.message ?? "") ? error.message : friendlyDbError(error);
    return { ok: false, message };
  }
  const delivered = typeof data === "number" ? data : 0;
  revalidateCourse(cur.course_id);
  return { ok: true, delivered, skipped: studentIds.length - delivered };
}
