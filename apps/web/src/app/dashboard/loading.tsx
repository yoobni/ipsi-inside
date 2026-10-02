/**
 * 대시보드 섹션 전환 중에 깔리는 뼈대.
 *
 * 대시보드 페이지는 전부 동적(force-dynamic·세션 쿠키)이라 클릭하는 순간 서버
 * 왕복이 시작된다. loading.tsx가 없으면 그 왕복이 끝날 때까지 이전 화면이 그대로
 * 멈춰 있어 눌린 건지 알 수 없다(Next 16: 동적 라우트는 loading 경계가 있어야
 * prefetch 대상이 된다). 각 페이지가 헤더를 직접 그리므로 헤더 자리도 같이 깐다.
 */
export default function DashboardLoading() {
  return (
    <div className="bg-background flex min-h-screen flex-col" aria-hidden>
      <div className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <div className="bg-muted h-6 w-28 animate-pulse rounded-md" />
          <div className="hidden gap-3 md:flex">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-muted/70 h-4 w-12 animate-pulse rounded" />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-muted/70 size-9 animate-pulse rounded-md" />
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 animate-pulse space-y-6 px-6 py-10">
        <div className="space-y-2">
          <div className="bg-muted h-8 w-56 rounded-md" />
          <div className="bg-muted/70 h-4 w-80 max-w-full rounded" />
        </div>
        <div className="border-hairline bg-muted/40 h-24 rounded-[14px] border" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-hairline bg-muted/30 h-16 rounded-[14px] border"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
