import { redirect } from "next/navigation";
import { top3BoardsSchema } from "@ipsi/types";
import { Badge } from "@/components/ui/badge";
import { getStaffContext } from "@/lib/auth";
import { GroupFilter } from "../daily/group-filter";
import { RankingForm } from "./ranking-form";

export const dynamic = "force-dynamic";

/**
 * TOP3 랭킹 설정 + 미리보기. 원장 전용(실명 공개 여부가 개인정보 설정이라).
 * 미리보기는 top3_boards(p_group)로 지금 학생들이 보게 될 그대로를 보여준다.
 */
export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group } = await searchParams;
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  if (ctx.staff.level !== "owner") redirect("/forbidden");
  const { supabase } = ctx;

  const [{ data: settings }, { data: sheets }, { data: groups }, { data: preview }] =
    await Promise.all([
      supabase.from("ranking_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("test_sheets").select("id, title").order("created_at", { ascending: false }).limit(50),
      supabase.from("student_groups").select("id, name").eq("archived", false).order("name"),
      supabase.rpc("top3_boards", { p_student: null, p_group: group ?? null }),
    ]);

  const parsed = top3BoardsSchema.safeParse(preview);
  const boards = parsed.success ? parsed.data : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">TOP3 랭킹</h1>
        <p className="text-muted-foreground text-sm">
          학생 리포트 화면에 뜨는 TOP3 보드예요. 1등~꼴등 전체 공개는 하지 않고, 항목별
          상위 3명만 보여줘요. 성적보다 성실도·성장도 보드가 자극이 돼요.
        </p>
      </div>

      <RankingForm
        values={{
          nameDisplay: settings?.name_display ?? "masked",
          scope: settings?.scope ?? "all",
          show: {
            homework: settings?.show_homework ?? true,
            attendance: settings?.show_attendance ?? true,
            growth: settings?.show_growth ?? true,
            test: settings?.show_test ?? true,
          },
          featuredTestSheetId: settings?.featured_test_sheet_id ?? null,
        }}
        sheets={sheets ?? []}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">미리보기</h2>
            <p className="text-muted-foreground text-xs">
              지금 설정으로 학생에게 보이는 그대로예요(이름 표시 포함).
              {boards && ` 범위: ${boards.settings.scope_label}`}
            </p>
          </div>
          <GroupFilter groups={groups ?? []} value={group ?? null} />
        </div>

        {!boards ? (
          <p className="text-muted-foreground rounded-md border border-dashed py-10 text-center text-sm">
            미리보기를 불러오지 못했어요.
          </p>
        ) : boards.boards.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed py-10 text-center text-sm">
            켜진 보드가 없어요.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {boards.boards.map((b) => (
              <div key={b.key} className="rounded-md border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{b.title}</p>
                  <Badge variant="outline">{b.pool_size}명 집계</Badge>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">{b.period_label}</p>
                {b.entries.length === 0 ? (
                  <p className="text-muted-foreground mt-3 rounded-md border border-dashed px-3 py-3 text-center text-xs">
                    {b.subtitle ?? "집계된 기록이 없어요"}
                  </p>
                ) : (
                  <ol className="mt-3 space-y-1">
                    {b.entries.map((e, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span>
                          <span className="text-muted-foreground mr-2 tabular-nums">{e.rank}위</span>
                          {e.name}
                        </span>
                        <span className="text-muted-foreground text-xs tabular-nums">{e.value_label}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
