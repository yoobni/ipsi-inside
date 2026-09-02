/**
 * 섹션 전환 중에 본문 자리에 깔리는 뼈대.
 *
 * 어드민 페이지는 전부 force-dynamic이라 클릭하는 순간 서버 왕복이 시작된다.
 * loading.tsx가 없으면 그 왕복이 끝날 때까지 **이전 화면이 그대로 멈춰 있어**
 * 눌린 건지 아닌지 알 수 없다. 이 뼈대를 두면 사이드바·상단 바는 남고 본문만
 * 즉시 바뀌어 전환이 시작됐다는 게 보인다(Next 16: 동적 라우트는 loading
 * 경계가 있어야 prefetch 대상이 된다).
 */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-6" aria-hidden>
      <div className="space-y-2">
        <div className="bg-muted h-7 w-48 rounded-md" />
        <div className="bg-muted/70 h-4 w-80 rounded" />
      </div>
      <div className="bg-muted/60 h-12 rounded-lg border" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-muted/40 h-14 rounded-lg border" />
        ))}
      </div>
    </div>
  );
}
