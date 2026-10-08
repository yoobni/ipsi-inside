/** 리포트 화면 뼈대 — 타일 4 + 차트 3 자리. 헤더는 dashboard/loading.tsx와 같은 꼴. */
export default function StatsLoading() {
  return (
    <div className="bg-background flex min-h-screen flex-col" aria-hidden>
      <div className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <div className="bg-muted h-6 w-28 animate-pulse rounded-md" />
          <div className="hidden gap-3 md:flex">
            {[0, 1, 2, 3, 4, 5].map((i) => (
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
      <main className="mx-auto w-full max-w-3xl flex-1 animate-pulse space-y-6 px-6 py-8">
        <div className="space-y-2">
          <div className="bg-muted h-8 w-40 rounded-md" />
          <div className="bg-muted/70 h-4 w-72 max-w-full rounded" />
        </div>
        <div className="border-hairline bg-muted/40 h-20 rounded-[14px] border" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-hairline bg-muted/30 h-28 rounded-[14px] border" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-hairline bg-muted/30 h-56 rounded-[14px] border" />
        ))}
      </main>
    </div>
  );
}
