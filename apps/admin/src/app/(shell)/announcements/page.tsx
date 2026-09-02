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

  // 제목 블록은 AnnouncementsClient가 그린다 — '새 공지'가 Sheet를 여는
  // 클라이언트 액션이라, 다른 목록 화면(자료/시험/지문)처럼 제목과 한 줄에
  // 두려면 헤더가 클라이언트 쪽에 있어야 한다.
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AnnouncementsClient rows={rows} />
    </div>
  );
}
