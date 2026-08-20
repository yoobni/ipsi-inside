import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";
import { dateOfDay, weekStartOf } from "@ipsi/types";
import { todayKst } from "@/lib/kst";
import { sendReminders, type ReminderTarget } from "@/lib/reminder";

export const dynamic = "force-dynamic";

const NOTIF_TYPE = "planner_reminder";

/**
 * 오늘 몫 국어 과제를 아직 체크하지 않은 학생에게 리마인더.
 *
 * Vercel Cron이 KST 21:00(= UTC 12:00)에 호출한다 — vercel.json 참조.
 * 학생 입력은 당일 24:00에 잠기므로 3시간 전에 한 번 알리는 배치다.
 * (Vercel Hobby는 크론 1일 1회 제한 — 21시 1회로 충족)
 *
 * 인증: Vercel이 CRON_SECRET을 Authorization: Bearer 로 붙여준다.
 * 세션이 없는 요청이라 proxy의 ALLOW_THROUGH_PREFIXES에 /api/cron이 들어가 있고,
 * 통과 후 여기서 시크릿을 검증한다.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "CRON_SECRET 미설정" },
      { status: 500 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const db = createAdminSupabaseClient();

  const today = todayKst();
  const weekStart = weekStartOf(today);
  const dayOfWeek = [0, 1, 2, 3, 4, 5, 6].find(
    (d) => dateOfDay(weekStart, d) === today,
  );
  if (dayOfWeek === undefined) {
    // weekStartOf가 항상 같은 주의 월요일을 주므로 정상 경로에선 일어나지 않는다
    return NextResponse.json(
      { ok: false, message: "요일 계산 실패", today, weekStart },
      { status: 500 },
    );
  }

  // 발행된 이번 주 플래너 → 오늘 요일의 국어 블록 → 과제 → 체크 여부
  const { data: weeks } = await db
    .from("planner_weeks")
    .select("id, student_id")
    .eq("week_start", weekStart)
    .eq("status", "published");

  const studentByWeek = new Map((weeks ?? []).map((w) => [w.id, w.student_id]));
  if (studentByWeek.size === 0) {
    return NextResponse.json({ ok: true, today, students: 0, sent: 0 });
  }

  const { data: blocks } = await db
    .from("planner_blocks")
    .select("id, week_id")
    .in("week_id", Array.from(studentByWeek.keys()))
    .eq("kind", "korean")
    .eq("day_of_week", dayOfWeek);

  const weekByBlock = new Map((blocks ?? []).map((b) => [b.id, b.week_id]));
  if (weekByBlock.size === 0) {
    return NextResponse.json({ ok: true, today, students: 0, sent: 0 });
  }

  const { data: tasks } = await db
    .from("planner_tasks")
    .select("id, block_id")
    .in("block_id", Array.from(weekByBlock.keys()));

  const allTasks = tasks ?? [];
  if (allTasks.length === 0) {
    return NextResponse.json({ ok: true, today, students: 0, sent: 0 });
  }

  const { data: checks } = await db
    .from("planner_task_checks")
    .select("task_id")
    .in(
      "task_id",
      allTasks.map((t) => t.id),
    );
  const checkedIds = new Set((checks ?? []).map((c) => c.task_id));

  // 학생별 미체크 개수
  const pendingByStudent = new Map<string, number>();
  for (const task of allTasks) {
    if (checkedIds.has(task.id)) continue;
    const weekId = weekByBlock.get(task.block_id);
    const studentId = weekId ? studentByWeek.get(weekId) : undefined;
    if (!studentId) continue;
    pendingByStudent.set(studentId, (pendingByStudent.get(studentId) ?? 0) + 1);
  }

  if (pendingByStudent.size === 0) {
    return NextResponse.json({ ok: true, today, students: 0, sent: 0 });
  }

  // 같은 날 두 번 울리지 않게 — 수동 호출이나 재시도로 크론이 겹칠 수 있다
  const kstMidnightUtc = new Date(`${today}T00:00:00+09:00`).toISOString();
  const { data: alreadySent } = await db
    .from("notifications")
    .select("user_id")
    .eq("type", NOTIF_TYPE)
    .gte("created_at", kstMidnightUtc)
    .in("user_id", Array.from(pendingByStudent.keys()));
  const sentToday = new Set((alreadySent ?? []).map((n) => n.user_id));

  const targets: ReminderTarget[] = Array.from(pendingByStudent.entries())
    .filter(([studentId]) => !sentToday.has(studentId))
    .map(([studentId, count]) => ({
      userId: studentId,
      payload: {
        title: "오늘 국어 과제 체크가 남았어요",
        body: `${count}개가 아직 비어 있어요. 밤 12시가 지나면 못 고쳐요.`,
        link: `/dashboard/planner?week=${weekStart}`,
      },
    }));

  const { sent, error } = await sendReminders(db, targets, NOTIF_TYPE);
  if (error) {
    return NextResponse.json({ ok: false, message: error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    today,
    students: pendingByStudent.size,
    skipped: pendingByStudent.size - targets.length,
    sent,
  });
}
