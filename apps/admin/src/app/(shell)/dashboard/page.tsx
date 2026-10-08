import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarRange,
  KeyRound,
  MessagesSquare,
  NotebookPen,
  Settings,
} from "lucide-react";
import { staffDashboardSchema, type StaffDashboard } from "@ipsi/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStaffContext } from "@/lib/auth";
import { RiskList } from "./risk-list";

export const dynamic = "force-dynamic";

/**
 * 업무 현황 — 조교(와 원장)가 로그인하면 처음 보는 화면. 메뉴를 돌아다니지 않고
 * "오늘 처리할 것"을 한 번에 본다. 숫자는 staff_dashboard() 한 번: 호출자 범위의
 * 학생만, 권한 없는 메뉴 블록은 null(카드 숨김).
 */
export default async function DashboardPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  const { supabase, staff } = ctx;

  const { data } = await supabase.rpc("staff_dashboard");
  const parsed = staffDashboardSchema.safeParse(data);
  const d: StaffDashboard | null = parsed.success ? parsed.data : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">업무 현황</h1>
          <p className="text-muted-foreground text-sm">
            {d ? `${d.today} · 담당 학생 ${d.student_count}명` : ""} — 오늘 처리할 일을 한눈에 봐요.
            항목을 누르면 해당 학생·화면으로 바로 가요.
          </p>
        </div>
        {staff.level === "owner" && (
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/risk-rules">
              <Settings className="size-4" />
              관리 필요 규칙
            </Link>
          </Button>
        )}
      </div>

      {!d ? (
        <p className="text-muted-foreground rounded-md border border-dashed py-10 text-center text-sm">
          현황을 불러오지 못했어요.
        </p>
      ) : (
        <>
          {/* 🔴 오늘 */}
          <div className="grid gap-3 md:grid-cols-3">
            {d.journal_missing && (
              <Card
                tone="red"
                icon={<NotebookPen className="size-4" />}
                title="일지 미작성"
                count={d.journal_missing.students.length}
                sub={d.journal_missing.basis === "attendance" ? "오늘 출석했는데 아직 안 씀" : "오늘 아직 안 씀(출석 마킹 전)"}
                href="/journals"
              >
                <NameList items={d.journal_missing.students.map((s) => ({ id: s.id, label: s.name, href: `/members/${s.id}` }))} />
              </Card>
            )}
            {d.homework_unchecked && (
              <Card
                tone="red"
                icon={<CalendarRange className="size-4" />}
                title="과제 미체크"
                count={d.homework_unchecked.students.length}
                sub="이번 주 도래한 플래너 과제를 체크 안 함"
                href="/planner"
              >
                <NameList
                  items={d.homework_unchecked.students.map((s) => ({
                    id: s.id,
                    label: `${s.name} · ${s.tasks}개`,
                    href: `/planner?student=${s.id}`,
                  }))}
                />
              </Card>
            )}
            {d.unmarked_today && (
              <Card
                tone="red"
                icon={<CalendarCheck className="size-4" />}
                title="오늘 마킹 안 함"
                count={d.unmarked_today.students.length}
                sub="출석·과제·테스트 점수 미입력"
                href="/daily"
              >
                <NameList items={d.unmarked_today.students.map((s) => ({ id: s.id, label: s.name, href: "/daily" }))} />
              </Card>
            )}
          </div>

          {/* 🟡 대기 */}
          <div className="grid gap-3 md:grid-cols-2">
            {d.qna_open && (
              <Card
                tone="amber"
                icon={<MessagesSquare className="size-4" />}
                title="미답변 Q&A"
                count={d.qna_open.count}
                sub="오래된 질문부터"
                href="/qna?filter=open"
              >
                <NameList
                  items={d.qna_open.items.map((q) => ({
                    id: q.id,
                    label: `${q.name} · ${relDays(q.created_at, d.today)}`,
                    href: `/qna/${q.id}`,
                  }))}
                />
              </Card>
            )}
            {d.password_pending && d.password_pending.students.length > 0 && (
              <Card
                tone="amber"
                icon={<KeyRound className="size-4" />}
                title="임시 비밀번호 미변경"
                count={d.password_pending.students.length}
                sub="발급 후 아직 새 비밀번호를 안 정함"
                href="/members"
              >
                <NameList items={d.password_pending.students.map((s) => ({ id: s.id, label: s.name, href: `/members/${s.id}` }))} />
              </Card>
            )}
          </div>

          {/* ⚠️ 관리 필요 */}
          <section className="rounded-md border bg-card">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                <h2 className="text-sm font-semibold">관리 필요 학생</h2>
                <Badge variant={d.risk.length > 0 ? "warning" : "outline"}>{d.risk.length}명</Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                연속 미작성·미이행·점수 급락·장기 미활동·연속 결석을 자동 감지해요
              </p>
            </div>
            <RiskList students={d.risk} />
          </section>
        </>
      )}
    </div>
  );
}

function Card({
  tone,
  icon,
  title,
  count,
  sub,
  href,
  children,
}: {
  tone: "red" | "amber";
  icon: React.ReactNode;
  title: string;
  count: number;
  sub: string;
  href: string;
  children: React.ReactNode;
}) {
  const dot = tone === "red" ? "bg-red-500" : "bg-amber-500";
  return (
    <section className="rounded-md border bg-card">
      <Link href={href} className="hover:bg-muted/40 flex items-start justify-between gap-3 px-4 py-3 transition-colors">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${count > 0 ? dot : "bg-muted-foreground/30"}`} />
            <span className="text-muted-foreground">{icon}</span>
            <h2 className="text-sm font-semibold">{title}</h2>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${count > 0 ? "" : "text-muted-foreground"}`}>{count}</span>
      </Link>
      {count > 0 && <div className="border-t px-4 py-2">{children}</div>}
    </section>
  );
}

/** 이름 목록 — 5명까지 보이고 나머지는 펼침 */
function NameList({ items }: { items: { id: string; label: string; href: string }[] }) {
  const head = items.slice(0, 5);
  const rest = items.slice(5);
  const Item = ({ it }: { it: { id: string; label: string; href: string } }) => (
    <li>
      <Link href={it.href} className="hover:text-primary text-sm hover:underline">
        {it.label}
      </Link>
    </li>
  );
  return (
    <ul className="space-y-0.5">
      {head.map((it) => <Item key={it.id} it={it} />)}
      {rest.length > 0 && (
        <li>
          <details>
            <summary className="text-muted-foreground cursor-pointer text-xs">+{rest.length}명 더</summary>
            <ul className="mt-1 space-y-0.5">
              {rest.map((it) => <Item key={it.id} it={it} />)}
            </ul>
          </details>
        </li>
      )}
    </ul>
  );
}

function relDays(iso: string, today: string): string {
  const d = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(iso)) / 86400000);
  return d <= 0 ? "오늘" : `${d}일 전`;
}
