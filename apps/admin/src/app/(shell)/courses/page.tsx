import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewCourseButton } from "./new-course";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const supabase = await createServerSupabaseClient();
  const [{ data: courses }, { data: links }, { data: sessions }, { data: groups }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, description, archived, updated_at")
      .eq("archived", showArchived)
      .order("updated_at", { ascending: false }),
    supabase.from("course_groups").select("course_id, group_id"),
    supabase.from("course_sessions").select("course_id"),
    supabase.from("student_groups").select("id, name, archived").order("name"),
  ]);

  const groupName = new Map((groups ?? []).map((g) => [g.id, g.name]));
  const sessionCount = new Map<string, number>();
  (sessions ?? []).forEach((s) => sessionCount.set(s.course_id, (sessionCount.get(s.course_id) ?? 0) + 1));
  const groupsOf = new Map<string, string[]>();
  (links ?? []).forEach((l) => {
    const name = groupName.get(l.group_id);
    if (name) groupsOf.set(l.course_id, [...(groupsOf.get(l.course_id) ?? []), name]);
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">코스·진도</h1>
          <p className="text-muted-foreground text-sm">
            코스 회차마다 복습지·퀴즈·OX 훈련·가이드·숙제를 미리 담아 두고, 수업이 끝나면 [수업 진행 처리]로
            그날 들은 학생에게 한 번에 배부해요. 중간에 들어온 학생은 지난 회차를 자동으로 받지 않아요 — 필요하면 보강 배부.
          </p>
        </div>
        <NewCourseButton groups={(groups ?? []).filter((g) => !g.archived).map((g) => ({ id: g.id, name: g.name }))} />
      </div>

      <div className="flex gap-2">
        <Button asChild size="sm" variant={showArchived ? "outline" : "default"}>
          <Link href="/courses">진행 중</Link>
        </Button>
        <Button asChild size="sm" variant={showArchived ? "default" : "outline"}>
          <Link href="/courses?archived=1">보관됨</Link>
        </Button>
      </div>

      {(courses ?? []).length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed py-16 text-center text-sm">
          {showArchived ? "보관된 코스가 없어요." : "아직 코스가 없어요. [새 코스]로 첫 코스를 만들어보세요."}
        </div>
      ) : (
        <ul className="space-y-2">
          {(courses ?? []).map((c) => {
            const gs = groupsOf.get(c.id) ?? [];
            return (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.id}`}
                  className="hover:border-primary/40 flex min-w-0 items-start gap-3 rounded-md border bg-card px-4 py-3 transition-colors"
                >
                  <GraduationCap className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{c.title}</p>
                      <span className="text-muted-foreground text-xs">{sessionCount.get(c.id) ?? 0}회차</span>
                      {c.archived && <Badge variant="outline">보관됨</Badge>}
                    </div>
                    {c.description && <p className="text-muted-foreground line-clamp-2 text-xs">{c.description}</p>}
                    <div className="flex flex-wrap gap-1">
                      {gs.length === 0 ? (
                        <Badge variant="warning">연결된 반 없음</Badge>
                      ) : (
                        gs.map((n) => (
                          <Badge key={n} variant="primary">
                            {n}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
