import Link from "next/link";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";

const AREAS = ["독서", "문학", "화법과 작문", "언어와 매체"] as const;

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);

  const showLoginCtas = state.kind === "guest";
  const showDashboardCta = state.kind === "ok" && state.status === "approved";
  const showPendingCta =
    state.kind === "ok" &&
    (state.status === "pending" ||
      state.status === "rejected" ||
      state.status === "suspended");
  const showLogoutOnly =
    state.kind === "admin-on-web" || state.kind === "missing-profile";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 border-b border-hairline bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Wordmark size="md" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {showLoginCtas && (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">로그인</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/signup">가입하기</Link>
                </Button>
              </>
            )}
            {showDashboardCta && (
              <Button asChild size="sm">
                <Link href="/dashboard">내 학습으로</Link>
              </Button>
            )}
            {(showPendingCta || showLogoutOnly) && (
              <div className="hidden md:block">
                <LogoutButton />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 상태별 배너 */}
      {state.kind === "ok" && state.status !== "approved" && (
        <div className="border-b border-primary/30 bg-primary-tint">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-3 text-sm md:flex-row md:items-center md:justify-between">
            <p className="text-foreground">
              <span className="font-bold text-primary">{state.fullName}님,</span>{" "}
              {state.status === "pending" &&
                "관리자 승인 대기 중이에요. 승인이 완료되면 강의/리포트가 열려요."}
              {state.status === "rejected" &&
                "가입이 반려되었어요. 학원에 문의해주세요."}
              {state.status === "suspended" &&
                "계정이 일시 정지되었어요. 학원에 문의해주세요."}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/pending">자세히 보기</Link>
            </Button>
          </div>
        </div>
      )}

      {state.kind === "admin-on-web" && (
        <div className="border-b border-primary/30 bg-primary-tint">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-3 text-sm md:flex-row md:items-center md:justify-between">
            <p className="text-foreground">
              <span className="font-bold text-primary">관리자 계정</span>으로
              로그인되어 있어요. 학생/학부모 페이지를 보려면 로그아웃 후 다시
              로그인해주세요.
            </p>
            <div className="w-full md:w-auto">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}

      {state.kind === "missing-profile" && (
        <div className="border-b border-primary/30 bg-primary-tint">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-3 text-sm md:flex-row md:items-center md:justify-between">
            <p className="text-foreground">
              계정 정보가 동기화되지 않았어요. 로그아웃 후 다시 가입해주세요.
            </p>
            <div className="w-full md:w-auto">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        <section className="relative overflow-hidden bg-foreground text-background">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 select-none overflow-hidden font-doodle text-3xl leading-[1.1] text-background/[0.06] md:text-4xl"
          >
            <div className="absolute left-8 top-10 rotate-[-4deg]">
              서술어의 자릿수 · 안긴문장 · 음운변동
            </div>
            <div className="absolute right-12 top-28 rotate-[6deg]">
              품사 / 형태소 / 비문학 추론
            </div>
            <div className="absolute bottom-16 left-16 rotate-[-2deg]">
              지문 길이는 곧 등급이다 · 매개모음
            </div>
            <div className="absolute right-20 bottom-32 rotate-[3deg]">
              운문 · 산문 · 화법 · 작문 · 매체
            </div>
          </div>

          <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
            <p className="font-accent text-2xl text-background/80 md:text-3xl">
              수능 국어, 안쪽을 본다.
            </p>
            <h1 className="mt-4 font-display text-[44px] leading-[1.1] md:text-[72px]">
              입시인사이드<span className="text-primary">.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-background/80 md:text-lg">
              강의 · 문제 풀이 · 자동 채점 · 약점 분석.
              <br className="hidden md:inline" />
              원장이 직접 짠 수능 국어 커리큘럼을, 한 화면에서.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {showLoginCtas && (
                <>
                  <Button asChild size="lg">
                    <Link href="/signup">지금 시작하기</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="border-background/40 text-background hover:bg-background/10"
                  >
                    <Link href="/login">로그인</Link>
                  </Button>
                </>
              )}
              {showDashboardCta && (
                <Button asChild size="lg">
                  <Link href="/dashboard">내 학습으로 →</Link>
                </Button>
              )}
              {showPendingCta && (
                <Button asChild size="lg">
                  <Link href="/pending">승인 상태 확인</Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="border-b border-hairline">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="font-display text-2xl md:text-3xl">네 영역, 빠짐없이.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              수능 국어 4영역을 모듈 단위로 다뤄요.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {AREAS.map((area) => (
                <span
                  key={area}
                  className="inline-flex items-center rounded-full border border-border-strong px-4 py-1.5 text-sm font-medium text-foreground"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-4 md:grid-cols-3">
            <FeatureCard
              tag="강의"
              title="VOD 강의 + 필기노트"
              body="강의 화면 옆에 지문 PDF와 원장 필기노트가 항상 붙어있어요."
            />
            <FeatureCard
              tag="문제"
              title="수능형 문제풀이"
              body="긴 지문 · 5지선다 · 타이머. 푸는 동안 시뮬레이션."
            />
            <FeatureCard
              tag="리포트"
              title="자동 채점 · 약점 분석"
              body="객관식 답안만 마킹하면 단원별 오답률이 그래프로 자동 정리돼요."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-6 text-sm text-muted-foreground md:flex-row md:items-center">
          <Wordmark size="sm" />
          <p>© {new Date().getFullYear()} 입시인사이드. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  tag,
  title,
  body,
}: {
  tag: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[14px] border border-hairline bg-surface p-6">
      <span className="inline-flex items-center rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-bold text-primary">
        {tag}
      </span>
      <h3 className="mt-3 text-base font-extrabold leading-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
