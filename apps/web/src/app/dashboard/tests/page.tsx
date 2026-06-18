import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function MyTestsPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");
  if (state.kind !== "ok") redirect("/dashboard");

  // 본인(자녀) 학생 id 결정
  let targetStudentIds: string[] = [];
  if (state.role === "student") {
    targetStudentIds = [state.userId];
  } else if (state.role === "parent") {
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_id", state.userId);
    targetStudentIds = (links ?? []).map((l) => l.student_id);
  }

  // 배정 + 시험지 + 학생 이름
  const { data: assignments } =
    targetStudentIds.length > 0
      ? await supabase
          .from("test_assignments")
          .select("id, test_sheet_id, student_id, status, assigned_at")
          .in("student_id", targetStudentIds)
          .order("assigned_at", { ascending: false })
      : { data: [] };

  const sheetIds = Array.from(new Set((assignments ?? []).map((a) => a.test_sheet_id)));

  const { data: sheets } =
    sheetIds.length > 0
      ? await supabase
          .from("test_sheets")
          .select("id, title, test_date")
          .in("id", sheetIds)
      : { data: [] };

  const sheetMap = new Map(
    (sheets ?? []).map((s) => [s.id, s] as const),
  );

  // 학부모인 경우 자녀 이름 매핑
  let studentNameMap = new Map<string, string>();
  if (state.role === "parent" && targetStudentIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", targetStudentIds);
    studentNameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <Wordmark size="md" />
          <nav className="text-muted-foreground hidden items-center gap-5 text-sm md:flex">
            <Link href="/dashboard" className="hover:text-foreground">
              홈
            </Link>
            <span className="text-foreground border-primary border-b-2 pb-1 font-bold">
              시험
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden md:block">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <div className="mb-8 space-y-1">
          <h1 className="font-display text-[34px] leading-tight">
            {state.role === "student" ? "내 시험 결과" : "자녀 시험 결과"}
          </h1>
          <p className="text-muted-foreground text-sm">
            배정된 시험과 채점된 결과를 한눈에 봐요.
          </p>
        </div>

        {!assignments || assignments.length === 0 ? (
          <div className="border-hairline rounded-[14px] border bg-surface p-10 text-center">
            <FileText className="text-muted-foreground mx-auto size-8" />
            <p className="text-muted-foreground mt-3 text-sm">
              아직 받은 시험이 없어요.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {assignments.map((a) => {
              const sheet = sheetMap.get(a.test_sheet_id);
              if (!sheet) return null;
              const isGraded = a.status === "graded";
              return (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/tests/${sheet.id}?studentId=${a.student_id}`}
                    className="border-hairline group flex items-center justify-between gap-4 rounded-[14px] border bg-surface p-5 transition-colors hover:border-primary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-extrabold">
                        {sheet.title}
                      </p>
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        {state.role === "parent" && (
                          <span className="text-primary font-semibold">
                            {studentNameMap.get(a.student_id)}
                          </span>
                        )}
                        {sheet.test_date && (
                          <span>시험일 {sheet.test_date}</span>
                        )}
                        <span>·</span>
                        <span>
                          {isGraded ? (
                            <span className="text-foreground font-bold">
                              채점 완료
                            </span>
                          ) : (
                            "채점 대기"
                          )}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="text-muted-foreground group-hover:text-primary size-5 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
