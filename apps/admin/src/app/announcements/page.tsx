import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { AnnouncementsClient, type AnnouncementRow } from "./announcements-client";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("announcements")
    .select(
      "id, title, body, audience, is_published, published_at, expires_at, created_at",
    )
    .order("created_at", { ascending: false });

  const rows: AnnouncementRow[] = (data ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    audience: a.audience as "all" | "student" | "parent",
    is_published: a.is_published,
    published_at: a.published_at,
    expires_at: a.expires_at,
    created_at: a.created_at,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">공지사항</h1>
        <p className="text-muted-foreground text-sm">
          학생/학부모 홈 상단에 노출되는 안내. 발행하면 알림 종에도 들어가요.
        </p>
      </div>

      <AnnouncementsClient rows={rows} />
    </div>
  );
}
