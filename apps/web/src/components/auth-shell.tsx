import type { ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * 로그인/가입 페이지의 좌측 브랜드 / 우측 폼 셸.
 * 모바일은 세로 스택.
 */
export function AuthShell({
  children,
  tagline = "입시의 안쪽을 본다.",
}: {
  children: ReactNode;
  tagline?: string;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* 우상단 테마 토글 */}
      <div className="fixed right-4 top-4 z-10 lg:right-6 lg:top-6">
        <ThemeToggle />
      </div>

      {/* 좌측 브랜드 — 모바일은 상단 헤더처럼 축소 */}
      <aside className="relative flex flex-col justify-between bg-foreground p-8 text-background lg:flex-1 lg:p-12">
        {/* 낙서 텍스처 (낮은 불투명도) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 select-none overflow-hidden font-doodle text-3xl leading-[1.1] text-background/[0.06]"
        >
          <div className="absolute left-6 top-12 rotate-[-4deg]">
            서술어의 자릿수 · 안긴문장 · 음운변동
          </div>
          <div className="absolute right-6 top-32 rotate-[6deg]">
            품사 / 형태소 / 비문학 추론
          </div>
          <div className="absolute bottom-24 left-10 rotate-[-2deg]">
            지문 길이는 곧 등급이다 · 매개모음
          </div>
        </div>

        <div className="relative">
          <Wordmark size="xl" className="text-background" />
          <p className="mt-4 font-accent text-2xl text-background/90 lg:text-3xl">
            {tagline}
          </p>
        </div>

        <div className="relative mt-8 hidden lg:block">
          <p className="text-sm text-background/60">
            수능 국어 · 독서 · 문학 · 화작 · 언매
          </p>
        </div>
      </aside>

      {/* 우측 폼 영역 */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 lg:px-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
