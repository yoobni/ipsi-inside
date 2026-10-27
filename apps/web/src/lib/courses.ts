import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ipsi/db";
import { homeworkDueDate, type CourseItemKind, type DeliveryKind } from "@ipsi/types";
import { todayKst } from "@/lib/kst";

/**
 * 내 강의실 — 배부받은 회차(course_session_deliveries)와 그 항목·진행 상황.
 *
 * RLS가 "배부받은 회차·그 코스·항목"만 돌려준다. 항목이 가리키는 원본(자료·시험지·훈련·가이드)은
 * 각자 RLS를 따르므로(미발행 훈련 등) 못 읽으면 available=false 로 두고 화면은 "준비 중"으로 그린다.
 * 조회는 단계별 일괄(.in) + 병렬 — 회차 수와 무관하게 왕복 4단계 안쪽.
 */

type Client = SupabaseClient<Database>;

/** NEW 배지 기간 */
const NEW_DAYS = 7;

export type ClassItem = {
  id: string;
  kind: CourseItemKind;
  title: string;
  /** 원본을 읽을 수 있는가(숙제는 항상 true) */
  available: boolean;
  /** 원본 id(자료·시험지·훈련·가이드). 숙제는 null */
  refId: string | null;
  /** 완료 여부. null = 알 수 없음(학부모는 자녀의 자료 열람 기록을 못 읽음) */
  done: boolean | null;
  /** 가이드 진도 k/n */
  progress?: { done: number; total: number };
  /** 자료에 PDF 파일이 있는가 */
  hasPdf?: boolean;
  /** 숙제 마감(KST YYYY-MM-DD) */
  dueDate?: string | null;
  overdue?: boolean;
};

export type ClassSessionStatus = "new" | "done" | "active";

export type ClassSession = {
  id: string;
  title: string;
  summary: string | null;
  position: number;
  deliveredAt: string;
  deliveryKind: DeliveryKind;
  status: ClassSessionStatus;
  items: ClassItem[];
};

export type ClassCourse = { id: string; title: string; sessions: ClassSession[] };

function isNew(deliveredAt: string, now = Date.now()) {
  return now - new Date(deliveredAt).getTime() < NEW_DAYS * 86400_000;
}

type DeliveryRow = { session_id: string; kind: DeliveryKind; delivered_at: string };
type SessionMeta = { id: string; courseId: string; courseTitle: string; title: string; summary: string | null; position: number };

/** 받은 회차 배부 행(최신 배부순). "받은 회차"의 정의는 이 한 곳 — 홈 카드와 강의실이 같이 쓴다. */
async function fetchDeliveries(supabase: Client, studentId: string, limit?: number): Promise<DeliveryRow[]> {
  let q = supabase
    .from("course_session_deliveries")
    .select("session_id, kind, delivered_at")
    .eq("student_id", studentId)
    .order("delivered_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data } = await q;
  return data ?? [];
}

/** 회차·코스 메타(제목 등). 다른 조회와 나란히 돌릴 수 있게 배부 행과 분리해 둔다. */
async function fetchSessionMeta(supabase: Client, sessionIds: string[]): Promise<Map<string, SessionMeta>> {
  if (sessionIds.length === 0) return new Map();
  const { data: sessions } = await supabase
    .from("course_sessions")
    .select("id, course_id, position, title, summary")
    .in("id", sessionIds);
  const courseIds = [...new Set((sessions ?? []).map((s) => s.course_id))];
  const { data: courses } =
    courseIds.length > 0
      ? await supabase.from("courses").select("id, title").in("id", courseIds)
      : { data: [] as { id: string; title: string }[] };
  const courseTitle = new Map((courses ?? []).map((c) => [c.id, c.title] as const));
  return new Map(
    (sessions ?? []).map((s) => [
      s.id,
      { id: s.id, courseId: s.course_id, courseTitle: courseTitle.get(s.course_id) ?? "", title: s.title, summary: s.summary, position: s.position },
    ]),
  );
}

/** 홈 카드용 — 최근 배부 회차 몇 개(완료 판정 없이 7일 이내면 NEW) */
export async function getRecentClassSessions(
  supabase: Client,
  studentId: string,
  limit = 3,
): Promise<{ sessionId: string; title: string; courseTitle: string; deliveredAt: string; isNew: boolean }[]> {
  const ds = await fetchDeliveries(supabase, studentId, limit);
  const meta = await fetchSessionMeta(supabase, ds.map((d) => d.session_id));
  return ds.flatMap((d) => {
    const m = meta.get(d.session_id);
    return m ? [{ sessionId: m.id, title: m.title, courseTitle: m.courseTitle, deliveredAt: d.delivered_at, isNew: isNew(d.delivered_at) }] : [];
  });
}

/**
 * 강의실 전체. viewerIsStudent=false(학부모)면 자료 열람 여부는 알 수 없음(null) —
 * material_downloads 는 본인 행만 읽힌다.
 */
export async function loadClassroom(
  supabase: Client,
  studentId: string,
  viewerIsStudent: boolean,
): Promise<ClassCourse[]> {
  const ds = await fetchDeliveries(supabase, studentId);
  if (ds.length === 0) return [];
  const sessionIds = ds.map((d) => d.session_id);

  // 2단계: 회차·코스 메타 ∥ 항목 ∥ 숙제 체크
  const [meta, { data: itemRows }, { data: checks }] = await Promise.all([
    fetchSessionMeta(supabase, sessionIds),
    supabase
      .from("course_session_items")
      .select("id, session_id, position, kind, material_id, test_sheet_id, drill_id, guide_id, title, due_days")
      .in("session_id", sessionIds)
      .order("position"),
    supabase.from("course_homework_checks").select("item_id").eq("student_id", studentId),
  ]);
  const items = itemRows ?? [];

  const ids = (k: "material_id" | "test_sheet_id" | "drill_id" | "guide_id") => [
    ...new Set(items.flatMap((i) => (i[k] ? [i[k] as string] : []))),
  ];
  const materialIds = ids("material_id");
  const sheetIds = ids("test_sheet_id");
  const drillIds = ids("drill_id");
  const guideIds = ids("guide_id");
  const none = Promise.resolve({ data: [] as never[] });

  // 3단계: 원본 제목(RLS 통과분만) + 진행 상황
  const [
    { data: materials },
    { data: materialFiles },
    { data: downloads },
    tests,
    { data: drills },
    { data: drillAttempts },
    { data: guides },
    { data: guideSteps },
    { data: guideProgress },
  ] = await Promise.all([
    materialIds.length ? supabase.from("materials").select("id, title").in("id", materialIds) : none,
    materialIds.length
      ? supabase.from("material_files").select("material_id, file_name").in("material_id", materialIds)
      : none,
    viewerIsStudent && materialIds.length
      ? supabase.from("material_downloads").select("material_id").eq("user_id", studentId).in("material_id", materialIds)
      : none,
    (async () => {
      if (sheetIds.length === 0) return { sheets: [], submittedSheetIds: new Set<string>() };
      const [{ data: sheets }, { data: asg }] = await Promise.all([
        supabase.from("test_sheets").select("id, title").in("id", sheetIds),
        supabase
          .from("test_assignments")
          .select("id, test_sheet_id")
          .eq("student_id", studentId)
          .in("test_sheet_id", sheetIds),
      ]);
      const asgIds = (asg ?? []).map((a) => a.id);
      const { data: attempts } =
        asgIds.length > 0
          ? await supabase
              .from("test_attempts")
              .select("assignment_id")
              .in("assignment_id", asgIds)
              .eq("status", "submitted")
          : { data: [] as { assignment_id: string }[] };
      const sheetByAsg = new Map((asg ?? []).map((a) => [a.id, a.test_sheet_id] as const));
      const submittedSheetIds = new Set(
        (attempts ?? []).flatMap((t) => {
          const sid = sheetByAsg.get(t.assignment_id);
          return sid ? [sid] : [];
        }),
      );
      return { sheets: sheets ?? [], submittedSheetIds };
    })(),
    drillIds.length ? supabase.from("drills").select("id, title").in("id", drillIds) : none,
    drillIds.length
      ? supabase
          .from("drill_attempts")
          .select("drill_id")
          .eq("student_id", studentId)
          .in("drill_id", drillIds)
          .not("finished_at", "is", null)
      : none,
    guideIds.length ? supabase.from("guides").select("id, title").in("id", guideIds) : none,
    guideIds.length ? supabase.from("guide_steps").select("guide_id").in("guide_id", guideIds) : none,
    guideIds.length
      ? supabase.from("guide_progress").select("guide_id").eq("student_id", studentId).in("guide_id", guideIds)
      : none,
  ]);

  const titleMap = (rows: { id: string; title: string }[] | null) =>
    new Map((rows ?? []).map((r) => [r.id, r.title] as const));
  const materialTitle = titleMap(materials);
  const sheetTitle = titleMap(tests.sheets);
  const drillTitle = titleMap(drills);
  const guideTitle = titleMap(guides);
  const pdfMaterials = new Set(
    (materialFiles ?? []).flatMap((f) => (/\.pdf$/i.test(f.file_name) ? [f.material_id] : [])),
  );
  const downloaded = new Set((downloads ?? []).map((d) => d.material_id));
  const drillDone = new Set((drillAttempts ?? []).map((a) => a.drill_id));
  const count = (rows: { guide_id: string }[] | null) => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r) => m.set(r.guide_id, (m.get(r.guide_id) ?? 0) + 1));
    return m;
  };
  const stepTotal = count(guideSteps);
  const stepDone = count(guideProgress);
  const checked = new Set((checks ?? []).map((c) => c.item_id));

  const deliveredAtBySession = new Map(ds.map((d) => [d.session_id, d.delivered_at] as const));
  const today = todayKst();

  const itemsBySession = new Map<string, ClassItem[]>();
  for (const i of items) {
    const deliveredAt = deliveredAtBySession.get(i.session_id);
    if (!deliveredAt) continue;
    let it: ClassItem;
    switch (i.kind) {
      case "material": {
        const t = materialTitle.get(i.material_id!);
        it = {
          id: i.id, kind: i.kind, refId: i.material_id, title: t ?? "", available: t != null,
          done: viewerIsStudent ? downloaded.has(i.material_id!) : null,
          hasPdf: pdfMaterials.has(i.material_id!),
        };
        break;
      }
      case "test": {
        const t = sheetTitle.get(i.test_sheet_id!);
        it = {
          id: i.id, kind: i.kind, refId: i.test_sheet_id, title: t ?? "", available: t != null,
          done: tests.submittedSheetIds.has(i.test_sheet_id!),
        };
        break;
      }
      case "drill": {
        const t = drillTitle.get(i.drill_id!);
        it = {
          id: i.id, kind: i.kind, refId: i.drill_id, title: t ?? "", available: t != null,
          done: drillDone.has(i.drill_id!),
        };
        break;
      }
      case "guide": {
        const t = guideTitle.get(i.guide_id!);
        const total = stepTotal.get(i.guide_id!) ?? 0;
        const d = Math.min(stepDone.get(i.guide_id!) ?? 0, total);
        it = {
          id: i.id, kind: i.kind, refId: i.guide_id, title: t ?? "", available: t != null,
          done: total > 0 && d >= total,
          progress: { done: d, total },
        };
        break;
      }
      case "homework": {
        const done = checked.has(i.id);
        const dueDate = homeworkDueDate(deliveredAt, i.due_days);
        it = {
          id: i.id, kind: i.kind, refId: null, title: i.title ?? "", available: true, done,
          dueDate, overdue: !done && dueDate != null && dueDate < today,
        };
        break;
      }
    }
    const list = itemsBySession.get(i.session_id) ?? [];
    list.push(it);
    itemsBySession.set(i.session_id, list);
  }

  const now = Date.now();
  const byCourse = new Map<string, ClassCourse>();
  // ds 가 최신 배부순이라 코스·회차도 그 순서로 쌓인다
  for (const d of ds) {
    const m = meta.get(d.session_id);
    if (!m) continue;
    const sItems = itemsBySession.get(m.id) ?? [];
    // 완료 판정은 읽을 수 있고 추적 가능한 항목만
    const trackable = sItems.filter((x) => x.available && x.done !== null);
    const complete = trackable.length > 0 && trackable.every((x) => x.done);
    const status: ClassSessionStatus = complete ? "done" : isNew(d.delivered_at, now) ? "new" : "active";
    const course = byCourse.get(m.courseId) ?? { id: m.courseId, title: m.courseTitle || "강의", sessions: [] };
    course.sessions.push({
      id: m.id,
      title: m.title,
      summary: m.summary,
      position: m.position,
      deliveredAt: d.delivered_at,
      deliveryKind: d.kind,
      status,
      items: sItems,
    });
    byCourse.set(m.courseId, course);
  }
  return [...byCourse.values()];
}
