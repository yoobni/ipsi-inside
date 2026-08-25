import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS_INFO, PRIVACY_OFFICER } from "@ipsi/types";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const AREAS = ["독서", "문학", "화법과 작문", "언어와 매체"] as const;

/**
 * 검색결과에 학원 정보로 묶여 보이게 하는 구조화 데이터.
 * 주소·전화번호·평점은 확인된 값이 없어 넣지 않는다 — 틀린 값이 노출되면
 * 지우기가 더 어렵다.
 */
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  description: SITE_DESCRIPTION,
  inLanguage: "ko-KR",
  areaServed: "KR",
  knowsAbout: ["수능 국어", ...AREAS],
} as const;

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(ORGANIZATION_JSON_LD),
        }}
      />
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
              주간 플래너 · 학습 일지 · 시험 리포트 · 자료 배부.
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
          <h2 className="font-display text-2xl md:text-3xl">
            계획부터 복기까지, 끊기지 않게.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            원장이 짜고 학생이 채우고, 다시 원장이 읽는 한 사이클.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              tag="플래너"
              title="주간 국어 플래너"
              body="원장이 요일·시간 단위로 짠 계획을 학생이 O·△·X로 체크하고, 사진으로 인증해요."
            />
            <FeatureCard
              tag="일지"
              title="학습 일지 + 원장 피드백"
              body="오늘 배운 것과 막힌 것을 적으면, 원장이 어제보다 나아진 점과 내일 고칠 것을 붙여줘요."
            />
            <FeatureCard
              tag="시험"
              title="수능형 시험 · 자동 채점"
              body="긴 지문 · 5지선다 · 타이머. 제출하면 바로 채점되고 오답이 정리돼요."
            />
            <FeatureCard
              tag="자료"
              title="지문 · 해설 PDF 배부"
              body="반 단위로도 개인별로도. 만료일을 걸어 필요한 기간에만 열어둬요."
            />
          </div>
        </section>

        <section className="border-t border-hairline bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <span className="inline-flex items-center rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-bold text-primary">
              학부모
            </span>
            <h2 className="mt-3 font-display text-2xl md:text-3xl">
              집에서도 같은 기록을 봅니다.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              별도 계정으로 자녀의 플래너 이행률, 일지와 원장 피드백, 시험
              리포트를 그대로 열어볼 수 있어요. &ldquo;오늘 뭐 했어?&rdquo;를
              물어보지 않아도 되게.
            </p>
          </div>
        </section>
      </main>

      {/*
        사업자 정보는 전자상거래법 제10조에 따라 **초기화면에** 있어야 한다.
        약관·처리방침 안에만 두면 표시의무를 채우지 못한다.
        값은 @ipsi/types의 BUSINESS_INFO 한 곳에서 온다.
      */}
      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-6xl space-y-5 px-6 py-8 text-sm text-muted-foreground">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <Wordmark size="sm" />
            <nav className="flex items-center gap-4">
              <Link href="/terms" className="hover:text-foreground">
                이용약관
              </Link>
              <Link href="/privacy" className="hover:text-foreground">
                개인정보처리방침
              </Link>
            </nav>
          </div>

          <div className="space-y-1 border-t border-hairline pt-5 text-xs leading-relaxed">
            <p>
              <span className="font-semibold text-foreground">
                {BUSINESS_INFO.name}
              </span>
              <span className="mx-1.5 text-hairline">|</span>
              대표자 {BUSINESS_INFO.representative}
              <span className="mx-1.5 text-hairline">|</span>
              사업자등록번호 {BUSINESS_INFO.registrationNumber}
            </p>
            <p>
              ({BUSINESS_INFO.postalCode}) {BUSINESS_INFO.address}
            </p>
            <p>
              전화 {BUSINESS_INFO.phone}
              <span className="mx-1.5 text-hairline">|</span>
              개인정보 보호책임자 {PRIVACY_OFFICER.name}
              {PRIVACY_OFFICER.email ? ` (${PRIVACY_OFFICER.email})` : ""}
            </p>
            <p className="pt-2">
              © {new Date().getFullYear()} 입시인사이드. All rights reserved.
            </p>
          </div>
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
