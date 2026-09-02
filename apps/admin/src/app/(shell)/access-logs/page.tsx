import { connection } from "next/server";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { AccessLogsClient, type LogRow } from "./access-logs-client";

export const dynamic = "force-dynamic";

/**
 * 개인정보 접속기록 점검 화면.
 *
 * 「개인정보의 안전성 확보조치 기준」 고시는 개인정보취급자의 접속기록을
 * 1년 이상 보관하고 **월 1회 이상 점검**하도록 한다. 기록은 쌓이고 있지만
 * 볼 방법이 psql뿐이면 점검은 실제로 일어나지 않는다.
 *
 * 여기서 볼 것: 평소와 다른 시간대의 접근, 갑작스러운 대량 반출,
 * 낯선 IP. 이상하면 비밀번호부터 바꾸고 원인을 찾는다.
 */
const DAYS = 30;

/** connection() 이후에만 부른다 — 컴포넌트 렌더 본문 밖이라 순수성 규칙에 걸리지 않는다. */
function sinceIso(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

export default async function AccessLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; action?: string }>;
}) {
  const sp = await searchParams;
  const days = Math.min(Math.max(Number(sp.days) || DAYS, 1), 400);
  const actionFilter = sp.action ?? "";

  // 조회 구간이 "지금"에 걸려 있다. 실제 요청이 들어온 뒤에 시계를 읽도록
  // 프리렌더에서 빼고(connection), 읽는 일 자체는 컴포넌트 밖으로 옮긴다
  // — 렌더 본문에서 Date.now()를 부르면 결과가 불안정해진다.
  await connection();
  const since = sinceIso(days);

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("admin_access_logs")
    .select("id, actor_id, action, target_type, target_id, detail, ip, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (actionFilter) query = query.eq("action", actionFilter);

  const { data: logs } = await query;

  // 원장 이름과 대상 학생 이름을 한 번에 붙인다 (행마다 조회하면 N+1이 된다)
  const ids = new Set<string>();
  (logs ?? []).forEach((l) => {
    if (l.actor_id) ids.add(l.actor_id);
    if (l.target_id) ids.add(l.target_id);
  });
  const { data: people } =
    ids.size > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(ids))
      : { data: [] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const rows: LogRow[] = (logs ?? []).map((l) => ({
    id: l.id,
    action: l.action,
    actorName: l.actor_id ? (nameOf.get(l.actor_id) ?? "(삭제된 계정)") : "—",
    targetName: l.target_id ? (nameOf.get(l.target_id) ?? "(알 수 없음)") : null,
    detail: l.detail as Record<string, unknown> | null,
    ip: l.ip,
    createdAt: l.created_at,
  }));

  // 마지막 점검 시각 — 기간 필터와 무관하게 항상 최신 1건을 본다
  const { data: lastReview } = await supabase
    .from("admin_access_logs")
    .select("created_at, actor_id")
    .eq("action", "audit.review")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">접속기록</h1>
        <p className="text-muted-foreground text-sm">
          관리자가 회원 개인정보를 열람하거나 내려받은 기록이에요. 법에 따라
          1년 이상 보관하고 <strong>한 달에 한 번 이상 점검</strong>해야 해요.
          평소와 다른 시간대의 접근, 갑작스러운 대량 내려받기, 낯선 IP가
          있는지 훑어보고 아래에서 점검 완료를 눌러주세요.
        </p>
      </div>

      <AccessLogsClient
        rows={rows}
        days={days}
        actionFilter={actionFilter}
        lastReviewedAt={lastReview?.created_at ?? null}
        lastReviewerName={
          lastReview?.actor_id ? (nameOf.get(lastReview.actor_id) ?? null) : null
        }
      />
    </div>
  );
}
