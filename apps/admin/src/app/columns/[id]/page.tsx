import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { ColumnEditor } from "../column-editor";

export const dynamic = "force-dynamic";

export default async function EditColumnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: col } = await supabase
    .from("columns")
    .select("id, title, body")
    .eq("id", id)
    .maybeSingle();
  if (!col) notFound();

  // 읽음 현황 — 누가 읽었는지
  const { data: reads } = await supabase
    .from("column_reads")
    .select("student_id, read_at")
    .eq("column_id", id)
    .order("read_at", { ascending: false });

  const readerIds = (reads ?? []).map((r) => r.student_id);
  const { data: readers } =
    readerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, school, grade")
          .in("id", readerIds)
      : { data: [] };
  const nameOf = new Map(
    (readers ?? []).map((p) => [p.id, p] as const),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">칼럼 편집</h1>
      </div>

      <ColumnEditor columnId={col.id} initialTitle={col.title} initialBody={col.body} />

      <section className="space-y-3">
        <h2 className="text-base font-bold">
          읽음 현황{" "}
          <span className="text-muted-foreground text-sm font-normal">
            {reads?.length ?? 0}명
          </span>
        </h2>
        {reads && reads.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b">
                <tr className="[&>th]:text-muted-foreground [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                  <th>학생</th>
                  <th>학교/학년</th>
                  <th>읽은 시각</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reads.map((r) => {
                  const p = nameOf.get(r.student_id);
                  return (
                    <tr key={r.student_id} className="[&>td]:px-3 [&>td]:py-2">
                      <td>{p?.full_name ?? "(알 수 없음)"}</td>
                      <td className="text-muted-foreground">
                        {p?.school ?? "-"}
                        {p?.grade ? ` ${p.grade}학년` : ""}
                      </td>
                      <td className="text-muted-foreground">
                        {new Date(r.read_at).toLocaleString("ko-KR", {
                          timeZone: "Asia/Seoul",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            아직 읽은 학생이 없어요.
          </p>
        )}
      </section>
    </div>
  );
}
