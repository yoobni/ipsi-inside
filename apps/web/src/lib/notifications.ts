import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ipsi/db";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * 본인 알림 + 미읽음 카운트. created_at <= now() 인 것만 (예약 발행된 알림 필터).
 */
export async function getMyNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 20,
): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const nowIso = new Date().toISOString();

  const { data, count } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at", {
      count: "exact",
    })
    .eq("user_id", userId)
    .lte("created_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  const items = (data ?? []) as NotificationItem[];
  // unread는 별도로 count
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
    .lte("created_at", nowIso);

  return {
    items,
    unreadCount: unread ?? 0,
  };
}
