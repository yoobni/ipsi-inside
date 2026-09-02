import { AdminShell } from "@/components/admin-shell";

/**
 * 사이드바 셸을 쓰는 어드민 화면 전부의 공용 레이아웃.
 *
 * 예전엔 섹션마다 똑같은 layout.tsx를 하나씩 두고 있었다. 파일이 다르면
 * Next에게는 다른 세그먼트라, 주간 플래너 → 자료 배부처럼 **섹션을 바꿀 때마다
 * 셸이 통째로 다시 렌더**됐다(상단 바의 인증·알림 조회 포함, 사이드바 리마운트).
 * 라우트 그룹으로 하나만 두면 형제 라우트끼리는 셸을 그대로 두고 본문만
 * 바꾼다. 그룹 이름은 URL에 들어가지 않아 경로는 그대로다.
 *
 * /login과 / (리다이렉트 전용)은 셸이 필요 없어 그룹 밖에 남겨둔다.
 */
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
