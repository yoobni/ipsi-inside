import { redirect } from "next/navigation";
import { ADMIN_LEVEL_LABEL, visibleMenu } from "@ipsi/types";
import { AdminShell } from "@/components/admin-shell";
import { getStaffContext } from "@/lib/auth";

/**
 * 사이드바 셸을 쓰는 어드민 화면 전부의 공용 레이아웃.
 *
 * 예전엔 섹션마다 똑같은 layout.tsx를 하나씩 두고 있었다. 파일이 다르면
 * Next에게는 다른 세그먼트라, 주간 플래너 → 자료 배부처럼 **섹션을 바꿀 때마다
 * 셸이 통째로 다시 렌더**됐다(상단 바의 인증·알림 조회 포함, 사이드바 리마운트).
 * 라우트 그룹으로 하나만 두면 형제 라우트끼리는 셸을 그대로 두고 본문만
 * 바꾼다. 그룹 이름은 URL에 들어가지 않아 경로는 그대로다.
 *
 * 메뉴는 교직원 권한으로 거른다 — 조교에게는 허용된 메뉴만 보인다.
 * getStaffContext는 요청 단위 캐시라 페이지가 다시 불러도 왕복은 한 번.
 *
 * /login과 / (리다이렉트 전용)은 셸이 필요 없어 그룹 밖에 남겨둔다.
 */
export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getStaffContext();
  // proxy가 이미 막지만, 셸이 교직원 아닌 세션에 그려지는 일은 없어야 한다.
  if (!ctx) redirect("/login");

  const { staff, supabase } = ctx;
  const { data: me } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", staff.id)
    .maybeSingle();

  // 클라이언트 컴포넌트로는 직렬화 가능한 href만 넘긴다(아이콘은 저쪽에서 붙임)
  const allowedHrefs = visibleMenu(staff.level, staff.permissions).map((m) => m.href);
  const staffLabel = `${me?.full_name ?? ""} · ${ADMIN_LEVEL_LABEL[staff.level]}`;

  return (
    <AdminShell allowedHrefs={allowedHrefs} staffLabel={staffLabel}>
      {children}
    </AdminShell>
  );
}
