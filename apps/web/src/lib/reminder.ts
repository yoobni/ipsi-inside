import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ipsi/db";

export type ReminderPayload = {
  title: string;
  body: string;
  link: string;
};

export type ReminderTarget = {
  userId: string;
  payload: ReminderPayload;
};

/**
 * 리마인더 발송 어댑터.
 *
 * 지금은 인앱 알림(notifications) 한 곳으로만 나간다. 카카오 알림톡은 채널 개설 +
 * 발신프로필 + 템플릿 심사(2~3주) + 건당 과금이라 범위 밖 — 나중에 채널이 붙어도
 * 호출부를 안 고치도록 발송부를 여기로 감싸둔다.
 *
 * 다건 일괄이 기본이다. 학생 30명을 순차 왕복하면 크론 한 번에 수십 요청이 난다.
 */
export async function sendReminders(
  db: SupabaseClient<Database>,
  targets: ReminderTarget[],
  type: string,
): Promise<{ sent: number; error: string | null }> {
  if (targets.length === 0) return { sent: 0, error: null };

  const nowIso = new Date().toISOString();
  const rows = targets.map((t) => ({
    user_id: t.userId,
    type,
    title: t.payload.title,
    body: t.payload.body,
    link: t.payload.link,
    created_at: nowIso,
  }));

  const { error } = await db.from("notifications").insert(rows);
  if (error) return { sent: 0, error: error.message };
  return { sent: rows.length, error: null };
}
