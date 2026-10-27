import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DELIVERY_KIND_LABEL } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { formatKstMonthDay } from "@/lib/kst";
import { cn } from "@/lib/utils";
import { studentLine } from "../../item-row";

export const dynamic = "force-dynamic";

/**
 * 진도표 — 학생 × 회차. 칸 = 배부일(수업/보강) + 숙제 완료 X/Y.
 * 행 = 연결된 반 학생 ∪ 한 회차라도 받은 학생(반을 옮겼거나 보강만 받은 학생도 보이게).
 * 배부·숙제 체크는 staff RLS가 담당 범위로 거른다.
 */
export default async function CourseProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: course }, { data: sessions }, { data: links }, { data: students }] = await Promise.all([
    supabase.from("courses").select("id, title").eq("id", id).maybeSingle(),
    supabase.from("course_sessions").select("id, title").eq("course_id", id).order("position"),
    supabase.from("course_groups").select("group_id").eq("course_id", id),
    supabase.from("profiles").select("id, full_name, school, grade").eq("role", "student").eq("status", "approved").order("full_name"),
  ]);
  if (!course) notFound();

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const groupIds = (links ?? []).map((l) => l.group_id);
  const [{ data: homework }, { data: deliveries }, { data: members }] = await Promise.all([
    sessionIds.length
      ? supabase.from("course_session_items").select("id, session_id").eq("kind", "homework").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as { id: string; session_id: string }[] }),
    sessionIds.length
      ? supabase.from("course_session_deliveries").select("session_id, student_id, kind, delivered_at").in("session_id", sessionIds)
      : Promise.resolve({ data: [] as { session_id: string; student_id: string; kind: "regular" | "makeup"; delivered_at: string }[] }),
    groupIds.length
      ? supabase.from("group_members").select("student_id").in("group_id", groupIds)
      : Promise.resolve({ data: [] as { student_id: string }[] }),
  ]);
  const hwIds = (homework ?? []).map((h) => h.id);
  const { data: checks } = hwIds.length
    ? await supabase.from("course_homework_checks").select("item_id, student_id").in("item_id", hwIds)
    : { data: [] as { item_id: string; student_id: string }[] };

  const hwBySession = new Map<string, string[]>();
  (homework ?? []).forEach((h) => hwBySession.set(h.session_id, [...(hwBySession.get(h.session_id) ?? []), h.id]));
  const done = new Set((checks ?? []).map((c) => `${c.item_id}:${c.student_id}`));
  const deliv = new Map((deliveries ?? []).map((d) => [`${d.session_id}:${d.student_id}`, d]));

  const rowIds = new Set<string>([...(members ?? []).map((m) => m.student_id), ...(deliveries ?? []).map((d) => d.student_id)]);
  const rows = (students ?? []).filter((s) => rowIds.has(s.id));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <Link href={`/courses/${id}`} className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline">
          <ArrowLeft className="size-3" />
          {course.title}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">진도표</h1>
        <p className="text-muted-foreground text-sm">
          학생별로 어느 회차를 언제 받았는지(수업/보강), 회차 숙제를 몇 개 끝냈는지 보여줘요. 빈 칸은 아직 안 받은 회차예요.
        </p>
      </div>

      {sessionIds.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-10 text-center text-sm">아직 회차가 없어요.</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-10 text-center text-sm">
          연결된 반 학생도, 배부받은 학생도 없어요.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="bg-muted sticky left-0 z-10 min-w-28 border-b px-3 py-2 text-left font-medium">학생</th>
                <th className="border-b px-3 py-2 text-center text-xs font-medium whitespace-nowrap">받은 회차</th>
                {(sessions ?? []).map((s, i) => (
                  <th key={s.id} className="max-w-32 border-b px-3 py-2 text-center text-xs font-medium">
                    <span className="text-muted-foreground block">{i + 1}</span>
                    <span className="line-clamp-2">{s.title}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((st) => {
                const got = sessionIds.filter((sid) => deliv.has(`${sid}:${st.id}`)).length;
                return (
                  <tr key={st.id} className="border-b last:border-b-0">
                    <td className="bg-background sticky left-0 z-10 px-3 py-2">
                      <Link href={`/members/${st.id}`} className="font-medium hover:underline">{st.full_name}</Link>
                      {studentLine(st) && <span className="text-muted-foreground block text-[11px]">{studentLine(st)}</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-xs tabular-nums">
                      {got}/{sessionIds.length}
                    </td>
                    {(sessions ?? []).map((s) => {
                      const d = deliv.get(`${s.id}:${st.id}`);
                      if (!d) return <td key={s.id} className="text-muted-foreground px-3 py-2 text-center text-xs">–</td>;
                      const hw = hwBySession.get(s.id) ?? [];
                      const hwDone = hw.filter((h) => done.has(`${h}:${st.id}`)).length;
                      return (
                        <td key={s.id} className="px-3 py-2 text-center text-xs whitespace-nowrap">
                          <span className={cn("block font-medium", d.kind === "makeup" && "text-amber-600 dark:text-amber-400")}>
                            {formatKstMonthDay(d.delivered_at)} {DELIVERY_KIND_LABEL[d.kind]}
                          </span>
                          {hw.length > 0 && (
                            <span
                              className={cn(
                                "block tabular-nums",
                                hwDone === hw.length ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                              )}
                            >
                              숙제 {hwDone}/{hw.length}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
