import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function TestsListPage() {
  const supabase = await createServerSupabaseClient();

  const { data: sheets } = await supabase
    .from("test_sheets")
    .select(
      "id, title, target_school, target_grade, open_at, due_at, allow_retake, created_at",
    )
    .order("created_at", { ascending: false });

  const sheetIds = (sheets ?? []).map((s) => s.id);

  const qCount = new Map<string, number>();
  const aCount = new Map<string, number>();
  if (sheetIds.length > 0) {
    const [tsq, ta] = await Promise.all([
      supabase
        .from("test_sheet_questions")
        .select("test_sheet_id")
        .in("test_sheet_id", sheetIds),
      supabase
        .from("test_assignments")
        .select("test_sheet_id")
        .in("test_sheet_id", sheetIds),
    ]);
    (tsq.data ?? []).forEach((r) =>
      qCount.set(r.test_sheet_id, (qCount.get(r.test_sheet_id) ?? 0) + 1),
    );
    (ta.data ?? []).forEach((r) =>
      aCount.set(r.test_sheet_id, (aCount.get(r.test_sheet_id) ?? 0) + 1),
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">시험 관리</h1>
          <p className="text-muted-foreground text-sm">
            등록된 문항을 골라 시험지를 만들고 학교/학생에게 배정해요.
          </p>
        </div>
        <Button asChild>
          <Link href="/tests/new">
            <Plus className="size-4" />새 시험지
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">제목</TableHead>
              <TableHead>대상</TableHead>
              <TableHead>일정</TableHead>
              <TableHead>문항</TableHead>
              <TableHead>배정</TableHead>
              <TableHead className="pr-4 text-right">생성일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sheets ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground h-24 text-center"
                >
                  아직 시험지가 없습니다. 우측 상단 [새 시험지]로 만들어보세요.
                </TableCell>
              </TableRow>
            ) : (
              (sheets ?? []).map((s) => (
                <TableRow key={s.id} className="cursor-pointer">
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/tests/${s.id}`} className="hover:underline">
                      {s.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {s.target_school
                      ? `${s.target_school}${s.target_grade ? ` · ${s.target_grade}학년` : ""}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <ScheduleLabel openAt={s.open_at} dueAt={s.due_at} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{qCount.get(s.id) ?? 0}문항</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={(aCount.get(s.id) ?? 0) > 0 ? "primary" : "outline"}>
                      {aCount.get(s.id) ?? 0}명
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground pr-4 text-right text-sm">
                    {new Date(s.created_at).toLocaleDateString("ko-KR")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ScheduleLabel({
  openAt,
  dueAt,
}: {
  openAt: string | null;
  dueAt: string | null;
}) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (!openAt && !dueAt) return <span>제한 없음</span>;
  if (openAt && dueAt) return <span>{fmt(openAt)} ~ {fmt(dueAt)}</span>;
  if (openAt) return <span>{fmt(openAt)} 부터</span>;
  return <span>~ {fmt(dueAt!)}</span>;
}
