"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { plannerCheckSubmitSchema, type PlannerCheckItem } from "@ipsi/types";
import { todayKst } from "@/lib/kst";

type Fail = { ok: false; message: string };
type Result = { ok: true; saved: number } | Fail;

/**
 * 학생 과제 체크 저장 (다건 일괄).
 *
 * 당일 24:00 제한은 2중으로 막는다:
 *   1) 여기서 과제의 실제 날짜가 KST 오늘인지 확인
 *   2) planner_task_checks RLS의 with check (액션을 우회해도 DB에서 거부)
 * checked_at은 DB default now() — 클라이언트 시각을 믿지 않는다.
 */
export async function submitPlannerChecksAction(
  items: PlannerCheckItem[],
): Promise<Result> {
  const parsed = plannerCheckSubmitSchema.safeParse({ items });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "student") {
    return { ok: false, message: "학생만 체크할 수 있어요" };
  }
  if (profile.status !== "approved") {
    return { ok: false, message: "승인 후 이용할 수 있어요" };
  }

  const today = todayKst();
  const taskIds = parsed.data.items.map((i) => i.task_id);

  // 과제가 내 것인지 + 실제 날짜가 오늘인지 원본에서 확인.
  // (RLS로 발행된 내 주차의 과제만 읽히므로 남의 과제는 여기서 이미 걸러진다)
  const { data: tasks, error: taskError } = await supabase
    .from("planner_tasks")
    .select("id, block_id, planner_blocks!inner(day_of_week, week_id)")
    .in("id", taskIds);
  if (taskError) return { ok: false, message: friendlyDbError(taskError) };

  const found = tasks ?? [];
  if (found.length !== taskIds.length) {
    return { ok: false, message: "체크할 수 없는 과제가 포함돼 있어요" };
  }

  const weekIds = Array.from(
    new Set(
      found.map((t) => {
        const block = t.planner_blocks as unknown as {
          day_of_week: number;
          week_id: string;
        };
        return block.week_id;
      }),
    ),
  );
  const { data: weeks } = await supabase
    .from("planner_weeks")
    .select("id, week_start, student_id, status")
    .in("id", weekIds);
  const weekById = new Map((weeks ?? []).map((w) => [w.id, w]));

  const rows: Array<{
    task_id: string;
    student_id: string;
    task_date: string;
    status: PlannerCheckItem["status"];
    late_reason: string | null;
    photo_path: string | null;
  }> = [];

  for (const item of parsed.data.items) {
    const task = found.find((t) => t.id === item.task_id);
    if (!task) return { ok: false, message: "과제를 찾을 수 없어요" };
    const block = task.planner_blocks as unknown as {
      day_of_week: number;
      week_id: string;
    };
    const week = weekById.get(block.week_id);
    if (!week || week.student_id !== user.id) {
      return { ok: false, message: "본인 과제만 체크할 수 있어요" };
    }
    if (week.status !== "published") {
      return { ok: false, message: "아직 배정되지 않은 플래너예요" };
    }

    const taskDate = addDays(week.week_start, block.day_of_week);
    if (taskDate !== today) {
      return {
        ok: false,
        message:
          taskDate < today
            ? "지난 날짜의 과제는 수정할 수 없어요. 선생님께 말씀해주세요."
            : "아직 오지 않은 날짜의 과제예요",
      };
    }

    rows.push({
      task_id: item.task_id,
      student_id: user.id,
      task_date: taskDate,
      status: item.status,
      late_reason: item.status === "late" ? (item.late_reason?.trim() || null) : null,
      photo_path: item.status === "missed" ? null : (item.photo_path ?? null),
    });
  }

  // 같은 날 안에서는 다시 눌러 바꿀 수 있다 (task_id unique)
  const { error } = await supabase
    .from("planner_task_checks")
    .upsert(rows, { onConflict: "task_id" });
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/dashboard/planner");
  revalidatePath("/dashboard");
  return { ok: true, saved: rows.length };
}

/** week_start(YYYY-MM-DD) + 요일 오프셋 → 날짜. DB planner_task_date와 같은 계산 */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
