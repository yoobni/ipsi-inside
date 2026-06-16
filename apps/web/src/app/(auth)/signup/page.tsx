import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { SignupTabs } from "./signup-tabs";
import { AuthShell } from "@/components/auth-shell";
import { LogoutButton } from "@/components/logout-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function SignupPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  if (state.kind === "ok") {
    if (state.status === "approved") redirect("/dashboard");
    redirect("/pending");
  }

  const inconsistent =
    state.kind === "admin-on-web" || state.kind === "missing-profile";

  return (
    <AuthShell tagline="가입 후 관리자 승인 한 번이면, 시작이에요.">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-[34px] leading-tight">가입하기</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              로그인
            </Link>
          </p>
        </div>

        {state.kind === "admin-on-web" && (
          <Alert variant="destructive">
            <AlertTitle>관리자 계정으로 로그인되어 있어요</AlertTitle>
            <AlertDescription>
              새 학생/학부모 계정을 만들려면 먼저 로그아웃해주세요.
            </AlertDescription>
          </Alert>
        )}
        {state.kind === "missing-profile" && (
          <Alert variant="destructive">
            <AlertTitle>이전 세션 정리 필요</AlertTitle>
            <AlertDescription>
              인증 세션이 남아있어요. 로그아웃 후 다시 가입해주세요.
            </AlertDescription>
          </Alert>
        )}

        {inconsistent ? <LogoutButton /> : <SignupTabs />}

        {!inconsistent && (
          <p className="text-xs text-faint">
            가입 신청 후 관리자 승인을 거쳐야 강의/리포트에 접근할 수 있어요.
          </p>
        )}
      </div>
    </AuthShell>
  );
}
