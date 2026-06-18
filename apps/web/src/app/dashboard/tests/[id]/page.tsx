import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { TestEntry } from "./test-entry";

export const dynamic = "force-dynamic";

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind !== "ok" || state.status !== "approved") redirect("/pending");
  if (state.role !== "student") redirect("/dashboard");

  const { data: sheet } = await supabase
    .from("test_sheets")
    .select(
      "id, title, description, open_at, due_at, allow_retake, max_attempts",
    )
    .eq("id", id)
    .maybeSingle();
  if (!sheet) notFound();

  const { data: assignment } = await supabase
    .from("test_assignments")
    .select("id")
    .eq("test_sheet_id", id)
    .eq("student_id", state.userId)
    .maybeSingle();
  if (!assignment) notFound();

  const { count: qCount } = await supabase
    .from("test_sheet_questions")
    .select("id", { count: "exact", head: true })
    .eq("test_sheet_id", id);

  const { data: attempts } = await supabase
    .from("test_attempts")
    .select("id, attempt_no, status, score, total_points, submitted_at, started_at")
    .eq("assignment_id", assignment.id)
    .order("attempt_no", { ascending: false });

  const inProgress = (attempts ?? []).find((a) => a.status === "in_progress");
  const submitted = (attempts ?? []).filter((a) => a.status === "submitted");

  const now = new Date();
  const isLocked = sheet.open_at != null && new Date(sheet.open_at) > now;
  const isClosed = sheet.due_at != null && new Date(sheet.due_at) < now;
  const maxAtt = sheet.allow_retake ? sheet.max_attempts ?? Infinity : 1;
  const canStart = !isLocked && !isClosed && submitted.length < maxAtt;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-background/80 px-6 py-4 backdrop-blur">
        <Wordmark size="md" />
        <ThemeToggle />
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
        <Link
          href="/dashboard/tests"
          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />내 시험 목록
        </Link>

        <h1 className="font-display mt-3 text-[28px] leading-tight">
          {sheet.title}
        </h1>
        {sheet.description && (
          <p className="text-muted-foreground mt-1 text-sm">
            {sheet.description}
          </p>
        )}

        <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>{qCount ?? 0}문항</span>
          {sheet.open_at && <span>오픈 {fmt(sheet.open_at)}</span>}
          {sheet.due_at && <span>마감 {fmt(sheet.due_at)}</span>}
          {sheet.allow_retake ? (
            <span>
              재응시{" "}
              {sheet.max_attempts
                ? `${submitted.length}/${sheet.max_attempts}회`
                : "무제한"}
            </span>
          ) : (
            <span>1회만</span>
          )}
        </div>

        <div className="mt-8">
          <TestEntry
            testSheetId={id}
            hasInProgress={!!inProgress}
            inProgressId={inProgress?.id ?? null}
            canStart={canStart}
            isLocked={isLocked}
            isClosed={isClosed}
          />
        </div>

        {submitted.length > 0 && (
          <section className="mt-10">
            <h2 className="text-foreground text-sm font-bold">응시 기록</h2>
            <ul className="mt-3 space-y-2">
              {submitted.map((a) => (
                <li
                  key={a.id}
                  className="border-hairline flex items-center justify-between gap-3 rounded-[12px] border bg-surface px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {a.attempt_no}회차
                      <span className="text-muted-foreground ml-2 text-xs font-normal">
                        {a.submitted_at ? fmt(a.submitted_at) : ""}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs">
                      <span className="text-primary tabular-nums text-sm font-bold">
                        {a.score} / {a.total_points}
                      </span>
                      <span className="text-muted-foreground ml-0.5">점</span>
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/tests/${id}/result?attempt=${a.id}`}
                    className="text-primary inline-flex items-center gap-1 text-xs font-bold hover:underline"
                  >
                    결과 보기
                    <ArrowRight className="size-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
