import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { LogoutButton } from "@/components/logout-button";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { WrongAccountNotice } from "@/components/wrong-account-notice";

export default async function PendingPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status === "approved") redirect("/dashboard");

  const statusCopy = {
    pending: {
      title: "승인 대기 중이에요.",
      body: "관리자 승인이 완료되면 강의와 리포트에 바로 접근할 수 있어요. 조금만 기다려주세요.",
    },
    rejected: {
      title: "가입 신청이 반려되었어요.",
      body: "학원에 문의해주세요. 본인 확인 후 다시 안내드릴게요.",
    },
    suspended: {
      title: "계정이 일시 정지되었어요.",
      body: "학원에 문의해주세요.",
    },
  } as const;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-hairline">
        <Wordmark size="md" />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {state.kind === "admin-on-web" ? (
          <WrongAccountNotice
            title="관리자 계정으로 로그인되어 있어요"
            description="로그아웃 후 학생/학부모 계정으로 다시 로그인해주세요."
          />
        ) : state.kind === "missing-profile" ? (
          <WrongAccountNotice
            title="계정 정보를 찾을 수 없어요"
            description="로그아웃 후 다시 가입해주세요."
          />
        ) : state.kind === "ok" ? (
          <div className="w-full max-w-md text-center space-y-8">
            <div className="space-y-3">
              <p className="font-accent text-2xl text-primary">
                {state.fullName}님, 안녕하세요
              </p>
              <h1 className="font-display text-[28px] leading-tight">
                {statusCopy[state.status as keyof typeof statusCopy]?.title}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {statusCopy[state.status as keyof typeof statusCopy]?.body}
              </p>
            </div>

            <div className="rounded-[14px] border border-hairline bg-surface p-5 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">계정 유형</span>
                <span className="font-bold text-foreground">
                  {state.role === "student" ? "학생" : "학부모"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">상태</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1 text-xs font-bold text-primary">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {state.status === "pending" && "승인 대기"}
                  {state.status === "rejected" && "반려"}
                  {state.status === "suspended" && "정지"}
                </span>
              </div>
            </div>

            <LogoutButton />
          </div>
        ) : null}
      </main>
    </div>
  );
}
