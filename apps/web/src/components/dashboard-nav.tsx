import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * 학생/학부모 상단 글로벌 내비게이션.
 *
 * 페이지마다 같은 markup을 복붙해 쓰다가 일지·내 정보 화면에서 통째로 누락됐다
 * (플래너를 추가할 때 4개 파일을 각각 고쳐야 했던 것도 같은 원인).
 * 링크가 늘어날 때 빠지는 화면이 생기지 않게 한 곳에서 관리한다.
 */
const ITEMS = [
  { key: "home", href: "/dashboard", label: "홈" },
  { key: "planner", href: "/dashboard/planner", label: "플래너" },
  { key: "tests", href: "/dashboard/tests", label: "시험" },
  { key: "journal", href: "/dashboard/journal", label: "일지" },
  { key: "qna", href: "/dashboard/qna", label: "Q&A" },
  { key: "columns", href: "/dashboard/columns", label: "칼럼" },
  { key: "materials", href: "/dashboard/materials", label: "자료" },
] as const;

export type DashboardNavKey = (typeof ITEMS)[number]["key"];

export function DashboardNav({ active }: { active?: DashboardNavKey }) {
  return (
    <nav className="text-muted-foreground hidden items-center gap-5 text-sm md:flex">
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
  );
}
