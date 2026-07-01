import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Users } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth-shell";
import { LogoutButton } from "@/components/logout-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const sp = await searchParams;
  const role: "student" | "parent" =
    sp.role === "parent" ? "parent" : "student";
  const isParent = role === "parent";

  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  // 정상 진행 가능한 경우만 자동 라우팅 — 어긋난 상태면 폼 + 로그아웃 안내로 떨궈서 루프 방지
  if (state.kind === "ok") {
    if (state.status === "approved") redirect("/dashboard");
    if (
      state.status === "pending" ||
      state.status === "rejected" ||
      state.status === "suspended"
    ) {
      redirect("/pending");
    }
  }

  const showInconsistentBanner =
    state.kind === "admin-on-web" || state.kind === "missing-profile";

  return (
    <AuthShell>
      <div className="space-y-8">
        <div className="space-y-3">
          <span
            className={
              isParent
                ? "border-hairline text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
                : "bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            }
          >
            {isParent ? (
              <>
                <Users className="size-3.5" /> 학부모
              </>
            ) : (
              <>
                <GraduationCap className="size-3.5" /> 학생
              </>
            )}
          </span>
          <div>
            <h1 className="font-display text-[34px] leading-tight">
              {isParent ? "학부모 로그인" : "학생 로그인"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              아직 회원이 아니신가요?{" "}
              <Link
                href="/signup"
                className="font-bold text-primary hover:underline"
              >
                가입하기
              </Link>
            </p>
          </div>
        </div>

        {state.kind === "admin-on-web" && (
          <Alert variant="destructive">
            <AlertTitle>관리자 계정으로 로그인되어 있어요</AlertTitle>
            <AlertDescription>
              학생/학부모 페이지를 이용하려면 먼저 로그아웃해주세요.
            </AlertDescription>
          </Alert>
        )}
        {state.kind === "missing-profile" && (
          <Alert variant="destructive">
            <AlertTitle>계정 정보 동기화 오류</AlertTitle>
            <AlertDescription>
              인증 세션은 있지만 계정 프로필을 찾을 수 없어요. 로그아웃 후 다시 가입해주세요.
            </AlertDescription>
          </Alert>
        )}

        {showInconsistentBanner ? (
          <LogoutButton />
        ) : (
          <>
            <LoginForm role={role} />

            {/* 역할 전환 */}
            <div className="border-hairline flex items-center justify-between gap-2 rounded-[14px] border px-4 py-3">
              <span className="text-muted-foreground text-sm">
                {isParent ? "학생이신가요?" : "학부모이신가요?"}
              </span>
              <Link
                href={isParent ? "/login" : "/login?role=parent"}
                className="border-hairline hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {isParent ? (
                  <>
                    <GraduationCap className="size-4" /> 학생 로그인
                  </>
                ) : (
                  <>
                    <Users className="size-4" /> 학부모 로그인
                  </>
                )}
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
