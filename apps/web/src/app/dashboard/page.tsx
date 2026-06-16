import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { LogoutButton } from "@/components/logout-button";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { WrongAccountNotice } from "@/components/wrong-account-notice";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  // 비로그인 → /login (login은 다시 dashboard로 보내지 않음 — 루프 없음)
  if (state.kind === "guest") redirect("/login");

  // status가 진행 불가 상태 → /pending 페이지에서 안내
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <Wordmark size="md" />
          <nav className="hidden md:flex items-center gap-5 text-sm text-muted-foreground">
            <span className="font-bold text-foreground border-b-2 border-primary pb-1">홈</span>
            <span>강의</span>
            <span>문제</span>
            <span>해설</span>
            <span>Q&amp;A</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden md:block">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-10">
        {state.kind === "admin-on-web" && (
          <WrongAccountNotice
            title="관리자 계정으로 로그인되어 있어요"
            description="이 페이지는 학생/학부모용이에요. 로그아웃 후 학생/학부모 계정으로 다시 로그인해주세요. 관리자 콘솔은 별도 어드민 페이지에서 이용할 수 있어요."
          />
        )}

        {state.kind === "missing-profile" && (
          <WrongAccountNotice
            title="계정 정보를 찾을 수 없어요"
            description="인증 세션은 있지만 프로필이 없어요. 로그아웃 후 다시 가입해주세요."
          />
        )}

        {state.kind === "ok" && state.role === "student" && (
          <StudentDashboard
            fullName={state.fullName}
            school={state.school}
            grade={state.grade}
          />
        )}

        {state.kind === "ok" && state.role === "parent" && (
          <ParentDashboard fullName={state.fullName} />
        )}

        <div className="mt-12 md:hidden">
          <LogoutButton />
        </div>
      </main>
    </div>
  );
}

function StudentDashboard({
  fullName,
  school,
  grade,
}: {
  fullName: string;
  school: string | null;
  grade: number | null;
}) {
  return (
    <div className="space-y-8">
      <section>
        <p className="font-accent text-2xl text-muted-foreground">
          오늘도 1지문 어때요?
        </p>
        <h1 className="font-display text-[34px] leading-tight mt-1">
          {fullName}님, 환영해요
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {school} · {grade ? `${grade}학년` : ""}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="학습 시간" value="0" unit="분" />
        <StatCard label="푼 문제" value="0" unit="문항" />
        <StatCard label="연속 학습" value="0" unit="일" />
      </section>

      <section className="rounded-[16px] border border-hairline bg-surface p-7">
        <h2 className="text-base font-extrabold">이어보기</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          아직 수강 중인 강의가 없어요. 곧 강의 목록이 열려요.
        </p>
      </section>
    </div>
  );
}

function ParentDashboard({ fullName }: { fullName: string }) {
  return (
    <div className="space-y-8">
      <section>
        <p className="font-accent text-2xl text-muted-foreground">
          꾸준한 학습, 함께 지켜볼게요.
        </p>
        <h1 className="font-display text-[34px] leading-tight mt-1">
          {fullName} 학부모님
        </h1>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="이번 주 학습" value="0" unit="시간" />
        <StatCard label="푼 문제" value="0" unit="문항" />
        <StatCard label="모의고사" value="-" unit="등급" />
      </section>

      <section className="rounded-[16px] border border-hairline bg-surface p-7">
        <h2 className="text-base font-extrabold">자녀 학습 리포트</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          관리자가 자녀와 계정을 연결하면 주간 리포트가 여기에 표시돼요.
        </p>
      </section>
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[14px] border border-hairline bg-surface p-6">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-[40px] leading-none text-primary">
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}
