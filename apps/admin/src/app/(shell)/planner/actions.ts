"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";
import {
  plannerWeekSaveSchema,
  plannerWeeklyCommentSchema,
  plannerTemplateSaveSchema,
  plannerTemplateRenameSchema,
  plannerTemplateApplySchema,
  plannerTemplatePayloadSchema,
  stripBlockIds,
  findPlannerOverlap,
  shortDayLabel,
  dateOfDay,
  weekStartOf,
  type PlannerBlockInput,
  type PlannerBlockKind,
} from "@ipsi/types";

type Fail = { ok: false; message: string };
type Result = { ok: true } | Fail;
/**
 * 저장 후 DB의 확정 상태(신규 행의 id 포함)를 그대로 돌려준다.
 * 클라이언트가 id를 못 받으면 다음 저장 때 같은 블록을 또 insert하게 된다.
 */
type SaveResult =
  | { ok: true; week_id: string; blocks: PlannerBlockInput[] }
  | Fail;

async function ensureAdmin(): Promise<{ adminId: string } | { error: Fail }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: { ok: false, message: "로그인이 필요합니다" } };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" || profile?.status !== "approved") {
    return { error: { ok: false, message: "권한이 없습니다" } };
  }
  return { adminId: user.id };
}

/**
 * 한 주 플래너 저장.
 *
 * 블록을 전부 지우고 다시 넣으면 planner_tasks → planner_task_checks가
 * cascade로 삭제돼 학생이 이미 남긴 O/△/X가 사라진다. 원장은 발행 후에도
 * 수시로 수정하므로 id 기반 diff(update / insert / delete)로 처리한다.
 */
export async function savePlannerWeekAction(input: {
  student_id: string;
  week_start: string;
  blocks: PlannerBlockInput[];
}): Promise<SaveResult> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const parsed = plannerWeekSaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const { student_id, week_start, blocks } = parsed.data;

  const overlap = findPlannerOverlap(blocks);
  if (overlap) return { ok: false, message: overlap };

  const db = createAdminSupabaseClient();

  // 1) 주차 행 확보 (없으면 생성)
  const { data: existingWeek } = await db
    .from("planner_weeks")
    .select("id")
    .eq("student_id", student_id)
    .eq("week_start", week_start)
    .maybeSingle();

  let weekId = existingWeek?.id ?? null;
  if (!weekId) {
    const { data: created, error } = await db
      .from("planner_weeks")
      .insert({
        student_id,
        week_start,
        created_by: check.adminId,
      })
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, message: friendlyDbError(error) };
    }
    weekId = created.id;
  }

  // 2) 블록 diff — 지울 것부터 정리한다.
  //
  // 저장은 드래그·편집 한 번마다 그 주 전체를 다시 보낸다. 예전엔 블록마다
  // update/insert → 과제 select → 과제별 update/insert를 순서대로 await 해서,
  // 블록 20·과제 30개인 주차를 한 칸 옮기는 데 왕복이 70번 넘게 났다.
  // 신규 행의 id를 여기서 미리 만들어 두면 블록·과제를 각각 upsert 한 번으로
  // 끝낼 수 있고, 왕복 수가 주차 크기와 무관해진다.
  const { data: currentBlocks } = await db
    .from("planner_blocks")
    .select("id")
    .eq("week_id", weekId);
  const currentBlockIds = new Set((currentBlocks ?? []).map((b) => b.id));

  const keptBlockIds = new Set<string>();
  // 클라이언트가 남의 주차 블록 id를 보내도 이 주차 것만 인정한다.
  blocks.forEach((b) => {
    if (b.id && currentBlockIds.has(b.id)) keptBlockIds.add(b.id);
  });

  const removedBlockIds = [...currentBlockIds].filter(
    (id) => !keptBlockIds.has(id),
  );
  if (removedBlockIds.length > 0) {
    const { error } = await db
      .from("planner_blocks")
      .delete()
      .in("id", removedBlockIds);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  // 3) 블록 일괄 upsert.
  //
  // 유지 블록은 id를 그대로 둬야 과제 → planner_task_checks가 cascade로
  // 날아가지 않는다(학생이 남긴 O/△/X 보존).
  //
  // 같은 id가 두 번 실려 오면 upsert 한 문장이 같은 행을 두 번 건드려 Postgres가
  // 통째로 거부한다("ON CONFLICT DO UPDATE ... a second time"). 클라이언트가 보낸
  // id는 믿지 않는다는 원칙대로, 두 번째부터는 신규 행으로 돌린다.
  const usedBlockIds = new Set<string>();
  const prepared = blocks.map((b, i) => {
    const kept = !!b.id && keptBlockIds.has(b.id) && !usedBlockIds.has(b.id);
    if (kept) usedBlockIds.add(b.id as string);
    return {
      incoming: b,
      row: {
        id: kept ? (b.id as string) : crypto.randomUUID(),
        week_id: weekId,
        day_of_week: b.day_of_week,
        start_min: b.start_min,
        end_min: b.end_min,
        kind: b.kind,
        label: b.label?.trim() || null,
        color: b.color ?? null,
        memo: b.memo?.trim() || null,
        position: i + 1,
      },
    };
  });

  if (prepared.length > 0) {
    const { error } = await db
      .from("planner_blocks")
      .upsert(prepared.map((p) => p.row));
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  // 4) 과제 diff — 유지 블록의 현재 과제를 한 번에 읽는다.
  const keptBlockIdList = [...keptBlockIds];
  const { data: currentTasks } = keptBlockIdList.length
    ? await db
        .from("planner_tasks")
        .select("id, block_id")
        .in("block_id", keptBlockIdList)
    : { data: [] };

  const currentTaskIdsByBlock = new Map<string, Set<string>>();
  (currentTasks ?? []).forEach((t) => {
    const set = currentTaskIdsByBlock.get(t.block_id) ?? new Set<string>();
    set.add(t.id);
    currentTaskIdsByBlock.set(t.block_id, set);
  });

  const keptTaskIds = new Set<string>();
  const taskRows: {
    id: string;
    block_id: string;
    tag_id: string | null;
    title: string;
    position: number;
  }[] = [];

  prepared.forEach((p) => {
    const blockId = p.row.id;
    const incomingTasks =
      p.incoming.kind === "korean" ? (p.incoming.tasks ?? []) : [];
    // 과제 id는 "같은 블록에 이미 있는 것"만 인정한다 — 블록 간 이동은
    // UI에 없고, 남의 블록 과제 id를 보내 가로채는 것도 막는다.
    const currentIds = currentTaskIdsByBlock.get(blockId) ?? new Set<string>();
    incomingTasks.forEach((t, j) => {
      const kept = !!t.id && currentIds.has(t.id) && !keptTaskIds.has(t.id);
      if (kept) keptTaskIds.add(t.id as string);
      taskRows.push({
        id: kept ? (t.id as string) : crypto.randomUUID(),
        block_id: blockId,
        tag_id: t.tag_id ?? null,
        title: t.title.trim(),
        position: j + 1,
      });
    });
  });

  const removedTaskIds = (currentTasks ?? [])
    .map((t) => t.id)
    .filter((id) => !keptTaskIds.has(id));
  if (removedTaskIds.length > 0) {
    const { error } = await db
      .from("planner_tasks")
      .delete()
      .in("id", removedTaskIds);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  if (taskRows.length > 0) {
    const { error } = await db.from("planner_tasks").upsert(taskRows);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  revalidatePath("/planner");
  return { ok: true, week_id: weekId, blocks: await loadWeekBlocks(weekId) };
}

/** 저장 직후 DB 확정 상태를 다시 읽어 클라이언트 상태를 정렬시킨다 */
async function loadWeekBlocks(weekId: string): Promise<PlannerBlockInput[]> {
  const db = createAdminSupabaseClient();

  const { data: blockRows } = await db
    .from("planner_blocks")
    .select("id, day_of_week, start_min, end_min, kind, label, color, memo")
    .eq("week_id", weekId)
    .order("day_of_week")
    .order("start_min");

  const blockIds = (blockRows ?? []).map((b) => b.id);
  const { data: taskRows } = blockIds.length
    ? await db
        .from("planner_tasks")
        .select("id, block_id, tag_id, title, position")
        .in("block_id", blockIds)
        .order("position")
    : { data: [] };

  return (blockRows ?? []).map((b) => ({
    id: b.id,
    day_of_week: b.day_of_week,
    start_min: b.start_min,
    end_min: b.end_min,
    kind: b.kind,
    label: b.label,
    color: b.color,
    memo: b.memo,
    tasks: (taskRows ?? [])
      .filter((t) => t.block_id === b.id)
      .map((t) => ({ id: t.id, title: t.title, tag_id: t.tag_id })),
  }));
}

/**
 * 발행 / 발행 취소.
 * 발행 시 학생 + 학부모에게 인앱 알림. 재발행(이미 published)에는 알림을 다시 쏘지 않는다.
 */
export async function publishPlannerWeekAction(
  weekId: string,
  publish: boolean,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();

  const { data: week } = await db
    .from("planner_weeks")
    .select("id, student_id, week_start, status")
    .eq("id", weekId)
    .maybeSingle();
  if (!week) return { ok: false, message: "플래너를 찾을 수 없습니다" };

  const wasPublished = week.status === "published";

  const { error } = await db
    .from("planner_weeks")
    .update({
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq("id", weekId);
  if (error) return { ok: false, message: friendlyDbError(error) };

  if (publish && !wasPublished) {
    await notifyPlannerPublished(week.student_id, week.week_start);
  }

  // 발행을 내리면 이미 나간 알림도 거둔다. 안 그러면 학생 알림함엔 "플래너가
  // 도착했어요"가 남아 있는데 눌러 들어가면 "배정된 플래너가 없어요" 빈 화면이 뜬다.
  if (!publish && wasPublished) {
    await clearPlannerNotifications(week.student_id, week.week_start);
  }

  revalidatePath("/planner");
  return { ok: true };
}

/** 플래너 알림 링크. 학부모용은 어느 자녀인지까지 담는다 */
function plannerLink(weekStart: string, childId?: string): string {
  const base = `/dashboard/planner?week=${weekStart}`;
  return childId ? `${base}&child=${childId}` : base;
}

/**
 * 그 주차로 향하는 플래너 알림 회수 — 학생 본인 + 연결된 학부모.
 *
 * planner_reminder는 지우지 않는다. 크론이 "오늘 이미 보냈는지"를 그 행의
 * 존재로 판단하므로(api/cron/planner-reminder), 지우면 같은 날 리마인더가
 * 두 번 갈 수 있다.
 */
async function clearPlannerNotifications(
  studentId: string,
  weekStart: string,
): Promise<void> {
  const db = createAdminSupabaseClient();
  const types = ["planner_published", "planner_comment"];

  // 학생 본인 — 자녀 파라미터가 없는 링크
  await db
    .from("notifications")
    .delete()
    .eq("user_id", studentId)
    .in("type", types)
    .eq("link", plannerLink(weekStart));

  // 학부모 — 이 자녀를 가리키는 링크만. 다자녀에서 다른 자녀 알림이
  // 함께 지워지지 않게 자녀 id로 좁힌다
  const { data: links } = await db
    .from("parent_student_links")
    .select("parent_id")
    .eq("student_id", studentId);
  const parentIds = (links ?? []).map((l) => l.parent_id);

  if (parentIds.length > 0) {
    await db
      .from("notifications")
      .delete()
      .in("user_id", parentIds)
      .in("type", types)
      .eq("link", plannerLink(weekStart, studentId));
  }
}

/** 발행 알림 fan-out — 학생 본인 + 연결된 학부모 */
async function notifyPlannerPublished(
  studentId: string,
  weekStart: string,
): Promise<void> {
  const db = createAdminSupabaseClient();

  const { data: student } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", studentId)
    .maybeSingle();

  const { data: links } = await db
    .from("parent_student_links")
    .select("parent_id")
    .eq("student_id", studentId);

  const range = `${shortDayLabel(weekStart)} ~ ${shortDayLabel(dateOfDay(weekStart, 6))}`;
  const nowIso = new Date().toISOString();

  const notifs = [
    {
      user_id: studentId,
      type: "planner_published",
      // 미래 주차도 배정할 수 있으니 "이번 주"로 못 박지 않는다 (본문에 기간 표시)
      title: "국어 플래너가 도착했어요",
      body: range,
      link: plannerLink(weekStart),
      created_at: nowIso,
    },
    ...(links ?? []).map((l) => ({
      user_id: l.parent_id,
      type: "planner_published",
      title: `${student?.full_name ?? "자녀"} 학생의 주간 플래너가 배정됐어요`,
      body: range,
      // 학부모 알림엔 자녀를 명시한다. 주차만 담으면 다자녀 학부모에서
      // 자녀별 알림이 구분되지 않아, 한 자녀의 발행을 내릴 때 다른 자녀
      // 알림까지 함께 지워진다 (링크가 바이트 단위로 같아서)
      link: plannerLink(weekStart, studentId),
      created_at: nowIso,
    })),
  ];

  // 중복 수신자 제거 (학부모 계정이 학생과 같을 일은 없지만 방어)
  const seen = new Set<string>();
  const unique = notifs.filter((n) => {
    if (seen.has(n.user_id)) return false;
    seen.add(n.user_id);
    return true;
  });

  if (unique.length > 0) {
    await db.from("notifications").insert(unique);
  }
}

/* ── 주간 총평 ────────────────────────────────────────────────────────────── */

/**
 * 주간 한 줄 총평 저장.
 *
 * 발행된 주차에 총평이 새로 달리거나 내용이 바뀌면 학생·학부모에게 알린다.
 * (draft 주차는 학생에게 아예 안 보이므로 알리지 않는다 — 발행 시점에
 *  planner_published 알림이 따로 나간다)
 */
export async function savePlannerWeeklyCommentAction(input: {
  week_id: string;
  weekly_comment: string | null;
}): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const parsed = plannerWeeklyCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const db = createAdminSupabaseClient();

  const { data: week } = await db
    .from("planner_weeks")
    .select("id, student_id, week_start, status, weekly_comment")
    .eq("id", parsed.data.week_id)
    .maybeSingle();
  if (!week) return { ok: false, message: "플래너를 찾을 수 없습니다" };

  // trim 후 빈 문자열도 '지우기'로 본다 (공백만 저장되면 학생 화면에 빈 카드가 뜬다)
  const comment = parsed.data.weekly_comment?.length
    ? parsed.data.weekly_comment
    : null;
  const previous = week.weekly_comment;

  const { error } = await db
    .from("planner_weeks")
    .update({
      weekly_comment: comment,
      comment_written_by: comment ? check.adminId : null,
      comment_written_at: comment ? new Date().toISOString() : null,
    })
    .eq("id", week.id);
  if (error) return { ok: false, message: friendlyDbError(error) };

  if (comment && comment !== previous && week.status === "published") {
    await notifyWeeklyComment(week.student_id, week.week_start);
  }

  revalidatePath("/planner");
  return { ok: true };
}

/** 총평 알림 fan-out — 학생 본인 + 연결된 학부모 */
async function notifyWeeklyComment(
  studentId: string,
  weekStart: string,
): Promise<void> {
  const db = createAdminSupabaseClient();

  const { data: student } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", studentId)
    .maybeSingle();

  const { data: links } = await db
    .from("parent_student_links")
    .select("parent_id")
    .eq("student_id", studentId);

  const range = `${shortDayLabel(weekStart)} ~ ${shortDayLabel(dateOfDay(weekStart, 6))}`;
  const nowIso = new Date().toISOString();

  const notifs = [
    {
      user_id: studentId,
      type: "planner_comment",
      title: "선생님이 주간 총평을 남겼어요",
      body: range,
      link: plannerLink(weekStart),
      created_at: nowIso,
    },
    ...(links ?? []).map((l) => ({
      user_id: l.parent_id,
      type: "planner_comment",
      title: `${student?.full_name ?? "자녀"} 학생의 주간 총평이 등록됐어요`,
      body: range,
      link: plannerLink(weekStart, studentId),
      created_at: nowIso,
    })),
  ];

  const seen = new Set<string>();
  const unique = notifs.filter((n) => {
    if (seen.has(n.user_id)) return false;
    seen.add(n.user_id);
    return true;
  });

  if (unique.length > 0) {
    await db.from("notifications").insert(unique);
  }
}

/* ── 템플릿 ───────────────────────────────────────────────────────────────── */

/** 현재 주차 구성을 '표준 루틴' 템플릿으로 저장 */
export async function savePlannerTemplateAction(input: {
  name: string;
  description?: string | null;
  blocks: PlannerBlockInput[];
}): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const parsed = plannerTemplateSaveSchema.safeParse({
    name: input.name,
    description: input.description ?? null,
    // 행 id를 그대로 담으면 불러올 때 남의 행을 덮어쓸 수 있다
    payload: { blocks: stripBlockIds(input.blocks) },
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  if (parsed.data.payload.blocks.length === 0) {
    return { ok: false, message: "저장할 블록이 없어요" };
  }

  const db = createAdminSupabaseClient();
  const { error } = await db.from("planner_templates").insert({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    payload: parsed.data.payload,
    created_by: check.adminId,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/planner");
  revalidatePath("/planner/templates");
  return { ok: true };
}

/**
 * 템플릿 이름·설명 수정.
 *
 * payload는 손대지 않는다. 이름을 잘못 저장했을 때 삭제 후 재생성하는 것이
 * 유일한 방법이면, 주차를 다시 구성해 템플릿으로 저장해야 한다.
 */
export async function renamePlannerTemplateAction(input: {
  template_id: string;
  name: string;
  description?: string | null;
}): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const parsed = plannerTemplateRenameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const db = createAdminSupabaseClient();
  const { error } = await db
    .from("planner_templates")
    .update({
      name: parsed.data.name,
      description: parsed.data.description?.trim() || null,
    })
    .eq("id", parsed.data.template_id);
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/planner");
  revalidatePath("/planner/templates");
  return { ok: true };
}

export async function deletePlannerTemplateAction(
  templateId: string,
): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();
  const { error } = await db
    .from("planner_templates")
    .delete()
    .eq("id", templateId);
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/planner/templates");
  return { ok: true };
}

type ApplyResult =
  | { ok: true; applied: number; skipped: number; skippedNames: string[] }
  | Fail;

/**
 * 템플릿을 여러 학생/그룹에 한 번에 배정.
 * 단건 배정만으로는 HWP 대비 효율이 안 난다 — 벌크가 기본.
 *
 * 행 id를 미리 만들어 블록/과제를 각각 한 번의 insert로 밀어넣는다
 * (학생 수 × 블록 수만큼 왕복하면 30명 배정에서 수백 번 왕복이 된다).
 */
export async function applyPlannerTemplateAction(input: {
  template_id: string;
  week_start: string;
  student_ids?: string[];
  group_ids?: string[];
  on_conflict?: "skip" | "overwrite";
  publish?: boolean;
}): Promise<ApplyResult> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const parsed = plannerTemplateApplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const { template_id, student_ids, group_ids, on_conflict, publish } =
    parsed.data;
  const weekStart = weekStartOf(parsed.data.week_start);

  const db = createAdminSupabaseClient();

  const { data: template } = await db
    .from("planner_templates")
    .select("id, name, payload")
    .eq("id", template_id)
    .maybeSingle();
  if (!template) return { ok: false, message: "템플릿을 찾을 수 없습니다" };

  const payload = plannerTemplatePayloadSchema.safeParse(template.payload);
  if (!payload.success) {
    return { ok: false, message: "템플릿 내용이 손상됐어요" };
  }
  const templateBlocks = payload.data.blocks;
  if (templateBlocks.length === 0) {
    return { ok: false, message: "템플릿에 블록이 없어요" };
  }

  // 1) 대상 학생 확정 — 직접 지정 + 그룹의 현재 멤버
  const targetIds = new Set<string>(student_ids ?? []);
  if ((group_ids ?? []).length > 0) {
    const { data: members } = await db
      .from("group_members")
      .select("student_id")
      .in("group_id", group_ids ?? []);
    (members ?? []).forEach((m) => targetIds.add(m.student_id));
  }

  // 승인된 학생만
  const { data: validStudents } = await db
    .from("profiles")
    .select("id, full_name")
    .eq("role", "student")
    .eq("status", "approved")
    .in("id", [...targetIds]);
  const students = validStudents ?? [];
  if (students.length === 0) {
    return { ok: false, message: "배정할 학생이 없어요" };
  }

  // 2) 기존 주차 확인
  const { data: existingWeeks } = await db
    .from("planner_weeks")
    .select("id, student_id")
    .eq("week_start", weekStart)
    .in(
      "student_id",
      students.map((s) => s.id),
    );
  const existingByStudent = new Map(
    (existingWeeks ?? []).map((w) => [w.student_id, w.id]),
  );

  const skippedNames: string[] = [];
  const weekIdByStudent = new Map<string, string>();
  const overwriteWeekIds: string[] = [];
  const newWeekRows: Array<{
    id: string;
    student_id: string;
    week_start: string;
    status: "draft" | "published";
    published_at: string | null;
    created_by: string;
  }> = [];
  const nowIso = new Date().toISOString();

  for (const s of students) {
    const existingId = existingByStudent.get(s.id);
    if (existingId) {
      if (on_conflict === "skip") {
        skippedNames.push(s.full_name);
        continue;
      }
      weekIdByStudent.set(s.id, existingId);
      overwriteWeekIds.push(existingId);
    } else {
      const id = crypto.randomUUID();
      newWeekRows.push({
        id,
        student_id: s.id,
        week_start: weekStart,
        status: publish ? "published" : "draft",
        published_at: publish ? nowIso : null,
        created_by: check.adminId,
      });
      weekIdByStudent.set(s.id, id);
    }
  }

  if (weekIdByStudent.size === 0) {
    return { ok: true, applied: 0, skipped: skippedNames.length, skippedNames };
  }

  if (newWeekRows.length > 0) {
    const { error } = await db.from("planner_weeks").insert(newWeekRows);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  // 3) 덮어쓰기 대상은 기존 블록 제거 (과제/체크가 cascade로 함께 사라짐 — UI에서 경고)
  if (overwriteWeekIds.length > 0) {
    const { error } = await db
      .from("planner_blocks")
      .delete()
      .in("week_id", overwriteWeekIds);
    if (error) return { ok: false, message: friendlyDbError(error) };

    // 발행 여부를 항상 명시적으로 덮어쓴다.
    // publish=false일 때 손대지 않으면 이미 발행됐던 주차가 계속 발행 상태로
    // 남아, '끄면 초안으로 들어간다'는 안내와 어긋난다. 게다가 덮어쓰기는
    // 기존 블록·체크를 지우므로, 학생이 알림도 없이 완전히 다른 플래너를
    // 보게 된다 — 새 내용은 원장이 발행할 때 나가야 한다.
    const { error: statusError } = await db
      .from("planner_weeks")
      .update(
        publish
          ? { status: "published", published_at: nowIso }
          : { status: "draft", published_at: null },
      )
      .in("id", overwriteWeekIds);
    if (statusError) {
      return { ok: false, message: friendlyDbError(statusError) };
    }
  }

  // 4) 블록/과제 벌크 insert — id를 미리 만들어 두 번의 왕복으로 끝낸다
  const blockRows: Array<{
    id: string;
    week_id: string;
    day_of_week: number;
    start_min: number;
    end_min: number;
    kind: PlannerBlockKind;
    label: string | null;
    color: string | null;
    memo: string | null;
    position: number;
  }> = [];
  const taskRows: Array<{
    block_id: string;
    tag_id: string | null;
    title: string;
    position: number;
  }> = [];

  for (const weekId of weekIdByStudent.values()) {
    templateBlocks.forEach((b, i) => {
      const blockId = crypto.randomUUID();
      blockRows.push({
        id: blockId,
        week_id: weekId,
        day_of_week: b.day_of_week,
        start_min: b.start_min,
        end_min: b.end_min,
        kind: b.kind,
        label: b.label?.trim() || null,
        color: b.color ?? null,
        memo: b.memo?.trim() || null,
        position: i + 1,
      });
      if (b.kind === "korean") {
        (b.tasks ?? []).forEach((t, j) => {
          taskRows.push({
            block_id: blockId,
            tag_id: t.tag_id ?? null,
            title: t.title.trim(),
            position: j + 1,
          });
        });
      }
    });
  }

  if (blockRows.length > 0) {
    const { error } = await db.from("planner_blocks").insert(blockRows);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  if (taskRows.length > 0) {
    const { error } = await db.from("planner_tasks").insert(taskRows);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  // 5) 발행이면 알림
  if (publish) {
    for (const studentId of weekIdByStudent.keys()) {
      await notifyPlannerPublished(studentId, weekStart);
    }
  }

  revalidatePath("/planner");
  revalidatePath("/planner/templates");
  return {
    ok: true,
    applied: weekIdByStudent.size,
    skipped: skippedNames.length,
    skippedNames,
  };
}

/** 주차 삭제 — 블록/과제/체크가 cascade로 함께 사라진다 */
export async function deletePlannerWeekAction(weekId: string): Promise<Result> {
  const check = await ensureAdmin();
  if ("error" in check) return check.error;

  const db = createAdminSupabaseClient();
  const { error } = await db.from("planner_weeks").delete().eq("id", weekId);
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/planner");
  return { ok: true };
}
