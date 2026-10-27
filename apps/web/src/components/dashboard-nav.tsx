import Link from "next/link";
import { cn } from "@/lib/utils";
import { DashboardMobileMenu } from "@/components/dashboard-mobile-menu";

/**
 * 학생/학부모 상단 글로벌 내비게이션.
 *
 * 페이지마다 같은 markup을 복붙해 쓰다가 일지·내 정보 화면에서 통째로 누락됐다
 * (플래너를 추가할 때 4개 파일을 각각 고쳐야 했던 것도 같은 원인).
 * 링크가 늘어날 때 빠지는 화면이 생기지 않게 한 곳에서 관리한다.
 *
 * 가로 메뉴는 lg 이상에서만 — 12개 항목이 그 아래 폭에선 헤더를 넘친다.
 * lg 미만은 햄버거(DashboardMobileMenu)가 같은 ITEMS를 받아 그린다.
 */
const ITEMS = [
  { key: "home", href: "/dashboard", label: "홈" },
  { key: "class", href: "/dashboard/class", label: "강의실" },
  { key: "planner", href: "/dashboard/planner", label: "플래너" },
  { key: "tests", href: "/dashboard/tests", label: "시험" },
  { key: "stats", href: "/dashboard/stats", label: "리포트" },
  { key: "drills", href: "/dashboard/drills", label: "훈련" },
  { key: "library", href: "/dashboard/library", label: "작품·개념" },
  { key: "guides", href: "/dashboard/guides", label: "가이드" },
  { key: "journal", href: "/dashboard/journal", label: "일지" },
  { key: "qna", href: "/dashboard/qna", label: "Q&A" },
  { key: "columns", href: "/dashboard/columns", label: "칼럼" },
  { key: "materials", href: "/dashboard/materials", label: "자료" },
] as const;

export type DashboardNavKey = (typeof ITEMS)[number]["key"];

export function DashboardNav({ active }: { active?: DashboardNavKey }) {
  return (
    <>
      <DashboardMobileMenu items={ITEMS} active={active} />
      <nav className="text-muted-foreground hidden items-center gap-4 text-sm lg:flex xl:gap-5">
        {ITEMS.map((item) =>
          item.key === active ? (
            <span
              key={item.key}
              aria-current="page"
              className="border-primary text-foreground border-b-2 pb-1 font-bold"
            >
              {item.label}
            </span>
          ) : (
            <Link
              key={item.key}
              href={item.href}
              className={cn("hover:text-foreground")}
            >
              {item.label}
            </Link>
          ),
        )}
      </nav>
    </>
  );
}
