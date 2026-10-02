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

export async function getMyNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 20,
): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const nowIso = new Date().toISOString();
  // 목록과 안 읽은 개수는 서로 독립 — 한 번에
  const [{ data }, { count: unread }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .eq("user_id", userId)
      .lte("created_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null)
      .lte("created_at", nowIso),
  ]);
  const items = (data ?? []) as NotificationItem[];

  return { items, unreadCount: unread ?? 0 };
}
