"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  courseDeliverResultSchema,
  courseDeliverSchema,
  courseSaveSchema,
  courseSessionSaveSchema,
  type CourseDeliverInput,
  type CourseDeliverResult,
  type CourseItemInput,
  type CourseSaveInput,
  type CourseSessionSaveInput,
} from "@ipsi/types";
import { friendlyDbError } from "@ipsi/lib";
import { ensureStaff } from "@/lib/auth";
import { todayKst } from "@/lib/kst";
import type { ItemRefs, StudentLite } from "./[id]/course-detail-client";
import { itemRowToInput } from "./item-row";

type Result = { ok: true; id: string } | { ok: false; message: string };
type ServerSupabase = Extract<Awaited<ReturnType<typeof ensureStaff>>, { supabase: unknown }>["supabase"];

const uuid = z.string().uuid();

function revalidateCourse(courseId: string) {
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/progress`);
}

/** 반 연결 갱신 — 선택 안 된 연결은 지우고, 선택된 반은 넣는다(반 목록은 교직원 전체가 다 본다). */
async function syncCourseGroups(supabase: ServerSupabase, courseId: string, groupIds: string[]): Promise<string | null> {
  const del = supabase.from("course_groups").delete().eq("course_id", courseId);
  const { error: dErr } = await (groupIds.length > 0 ? del.not("group_id", "in", `(${groupIds.join(",")})`) : del);
  if (dErr) return friendlyDbError(dErr);
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

/**
 * 같은 코스 안에서 바로 위/아래 회차와 자리를 바꾼다.
 * (course_id, position) 유니크라 바로 맞바꿀 수 없다 — 현재 회차를 임시 자리(0 이하)로 비켜 둔 뒤 바꾼다.
 */
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

  const steps: [string, number][] = [
    [cur.id, -cur.position],
    [other.id, cur.position],
    [cur.id, other.position],
  ];
  for (const [id, position] of steps) {
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

type SaveSessionResult = { ok: true; id: string; items: CourseItemInput[] } | { ok: false; message: string };

/**
 * 항목이 가리키는 자료·시험지·훈련·가이드가 **이 교직원 세션으로 읽히는지** 확인한다.
 * 배부는 definer RPC가 하므로, 못 보는 시험지 id를 직접 넣어 배정을 만드는 길을 여기서 막는다.
 * 시험지는 정규(kind='regular')만 — 보충 세트는 학생별 자동 생성물이라 회차에 못 담는다.
 */
async function checkItemRefs(supabase: ServerSupabase, items: CourseItemInput[]): Promise<string | null> {
  const pick = <K extends CourseItemInput["kind"]>(kind: K) =>
    items.filter((it): it is Extract<CourseItemInput, { kind: K }> => it.kind === kind);
  const materialIds = pick("material").map((it) => it.materialId);
  const sheetIds = pick("test").map((it) => it.testSheetId);
  const drillIds = pick("drill").map((it) => it.drillId);
  const guideIds = pick("guide").map((it) => it.guideId);
  const none = Promise.resolve({ data: [] as { id: string }[], error: null });
  const [m, t, d, g] = await Promise.all([
    materialIds.length ? supabase.from("materials").select("id").in("id", materialIds) : none,
    sheetIds.length ? supabase.from("test_sheets").select("id").eq("kind", "regular").in("id", sheetIds) : none,
    drillIds.length ? supabase.from("drills").select("id").in("id", drillIds) : none,
    guideIds.length ? supabase.from("guides").select("id").in("id", guideIds) : none,
  ]);
  for (const r of [m, t, d, g]) if (r.error) return friendlyDbError(r.error);
  const ok = (want: string[], got: { id: string }[] | null) => {
    const have = new Set((got ?? []).map((r) => r.id));
    return want.every((id) => have.has(id));
  };
  if (!ok(materialIds, m.data) || !ok(sheetIds, t.data) || !ok(drillIds, d.data) || !ok(guideIds, g.data))
    return "볼 수 없거나 삭제된 항목이 있어요. 목록에서 다시 골라주세요.";
  return null;
}

/**
 * 회차 저장 — 제목·요약 + 항목(순서 = 배열 순서).
 * id 있는 항목은 그 행을 갱신(문구·마감·순서), 없으면 추가, 목록에서 빠진 행은 삭제.
 * 행을 지웠다 다시 넣으면 학생 숙제 완료 체크가 cascade 로 날아가므로 id 로 맞춘다.
 * 저장 뒤 sync RPC 가 이미 받은 학생에게도 새 자료·시험 배정을 채운다(알림은 없음).
 */
export async function saveSessionAction(sessionId: string, input: CourseSessionSaveInput): Promise<SaveSessionResult> {
  const check = await ensureStaff({ permission: "courses" });
  if ("error" in check) return check.error;
  if (!uuid.safeParse(sessionId).success) return { ok: false, message: "잘못된 요청이에요" };
  const parsed = courseSessionSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "검증 실패" };
  const s = parsed.data;
  const { supabase } = check;

  const refErr = await checkItemRefs(supabase, s.items);
  if (refErr) return { ok: false, message: refErr };

  const { data: cur, error: sErr } = await supabase
    .from("course_sessions")
    .update({ title: s.title, summary: s.summary || null })
    .eq("id", sessionId)
    .select("course_id")
    .maybeSingle();
  if (sErr) return { ok: false, message: friendlyDbError(sErr) };
  if (!cur) return { ok: false, message: "회차를 찾을 수 없어요" };

  const { data: existing, error: eErr } = await supabase.from("course_session_items").select("id").eq("session_id", sessionId);
  if (eErr) return { ok: false, message: friendlyDbError(eErr) };
  const existingIds = new Set((existing ?? []).map((r) => r.id));

  const toRow = (it: CourseItemInput, position: number) => ({
    session_id: sessionId,
    position,
    kind: it.kind,
    material_id: it.kind === "material" ? it.materialId : null,
    test_sheet_id: it.kind === "test" ? it.testSheetId : null,
    drill_id: it.kind === "drill" ? it.drillId : null,
    guide_id: it.kind === "guide" ? it.guideId : null,
    title: it.kind === "homework" ? it.title : null,
    due_days: it.kind === "homework" ? it.dueDays : null,
  });

  // 다른 회차의 행 id를 끼워 넣어도 이 회차 것만 갱신되게, 이 회차에 실제 있는 id만 인정
  const keepIds = new Set<string>();
  const updates: { id: string; row: ReturnType<typeof toRow> }[] = [];
  const inserts: ReturnType<typeof toRow>[] = [];
  s.items.forEach((it, i) => {
    const row = toRow(it, i + 1);
    if (it.id && existingIds.has(it.id) && !keepIds.has(it.id)) {
      keepIds.add(it.id);
      updates.push({ id: it.id, row });
    } else {
      inserts.push(row);
    }
  });
  const drop = [...existingIds].filter((id) => !keepIds.has(id));

  if (drop.length > 0) {
    const { error } = await supabase.from("course_session_items").delete().eq("session_id", sessionId).in("id", drop);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  for (const u of updates) {
    const { error } = await supabase.from("course_session_items").update(u.row).eq("id", u.id).eq("session_id", sessionId);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from("course_session_items").insert(inserts);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  const { error: syncErr } = await supabase.rpc("sync_course_session_assignments", { p_session_id: sessionId });
  if (syncErr) return { ok: false, message: friendlyDbError(syncErr) };

  // 저장된 행 id를 돌려줘 편집기가 다음 저장부터 id로 맞추게 한다
  const { data: saved } = await supabase
    .from("course_session_items")
    .select("id, kind, material_id, test_sheet_id, drill_id, guide_id, title, due_days")
    .eq("session_id", sessionId)
    .order("position");

  revalidateCourse(cur.course_id);
  return { ok: true, id: sessionId, items: (saved ?? []).flatMap(itemRowToInput) };
}

export async function deliverSessionAction(
  input: CourseDeliverInput,
): Promise<({ ok: true } & CourseDeliverResult) | { ok: false; message: string }> {
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
  const result = courseDeliverResultSchema.safeParse(data);
  if (!result.success) return { ok: false, message: "배부 결과를 읽지 못했어요. 화면을 새로고침해 확인해주세요." };
  revalidateCourse(cur.course_id);
  return { ok: true, ...result.data };
}

// ─── 편집기·배부 시트가 열릴 때만 읽는 목록 ─────────────────────────────────────
// 코스 상세 진입마다 자료·시험지·훈련·가이드·학생 전체를 읽지 않게 여기로 뺐다.

/** 항목 피커 선택지 — 교직원이 볼 수 있는 것만(RLS). */
export async function loadItemRefsAction(): Promise<{ ok: true; refs: ItemRefs } | { ok: false; message: string }> {
  const check = await ensureStaff({ permission: "courses" });
  if ("error" in check) return check.error;
  const { supabase } = check;
  const [{ data: materials }, { data: tests }, { data: drills }, { data: guides }] = await Promise.all([
    supabase.from("materials").select("id, title, audience, is_published").order("created_at", { ascending: false }),
    supabase.from("test_sheets").select("id, title").eq("kind", "regular").order("created_at", { ascending: false }),
    supabase.from("drills").select("id, title, is_published").order("created_at", { ascending: false }),
    supabase.from("guides").select("id, title, status").order("created_at", { ascending: false }),
  ]);
  return {
    ok: true,
    refs: {
      materials: (materials ?? []).map((m) => ({ id: m.id, title: m.title, audience: m.audience, published: m.is_published })),
      tests: (tests ?? []).map((t) => ({ id: t.id, title: t.title })),
      drills: (drills ?? []).map((d) => ({ id: d.id, title: d.title, published: d.is_published })),
      guides: (guides ?? []).map((g) => ({ id: g.id, title: g.title, published: g.status === "published" })),
    },
  };
}

export type Roster = { students: StudentLite[]; members: { group_id: string; student_id: string }[]; absentIds: string[] };

/** 배부 시트용 명단 — 담당 범위 학생·반 멤버십·오늘(KST) 결석. 'daily' 권한이 없으면 결석은 비어 온다. */
export async function loadRosterAction(): Promise<{ ok: true; roster: Roster } | { ok: false; message: string }> {
  const check = await ensureStaff({ permission: "courses" });
  if ("error" in check) return check.error;
  const { supabase } = check;
  const [{ data: students }, { data: members }, { data: absents }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, school, grade").eq("role", "student").eq("status", "approved").order("full_name"),
    supabase.from("group_members").select("group_id, student_id"),
    supabase.from("daily_attendance").select("student_id").eq("date", todayKst()).eq("attendance", "absent"),
  ]);
  return {
    ok: true,
    roster: {
      students: (students ?? []).map((s) => ({ id: s.id, name: s.full_name, school: s.school, grade: s.grade })),
      members: members ?? [],
      absentIds: (absents ?? []).map((a) => a.student_id),
    },
  };
}
