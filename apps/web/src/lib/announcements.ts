import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ipsi/db";
import type { AnnouncementItem } from "@/components/announcement-banner";

export async function getActiveAnnouncements(
  supabase: SupabaseClient<Database>,
): Promise<AnnouncementItem[]> {
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(5);
  return (data ?? []) as AnnouncementItem[];
}
