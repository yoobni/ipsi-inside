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
    .select("id, title, target_school, target_grade, test_date, created_at")
    .order("created_at", { ascending: false });

  // 시험지별 문항/배정/채점 카운트
  const sheetIds = (sheets ?? []).map((s) => s.id);

  let questionCounts = new Map<string, number>();
  let assignedCounts = new Map<string, number>();
  let gradedCounts = new Map<string, number>();

  if (sheetIds.length > 0) {
    const [qRes, aRes] = await Promise.all([
      supabase
        .from("test_questions")
        .select("test_sheet_id")
        .in("test_sheet_id", sheetIds),
      supabase
        .from("test_assignments")
        .select("test_sheet_id, status")
        .in("test_sheet_id", sheetIds),
    ]);

    (qRes.data ?? []).forEach((q) => {
      questionCounts.set(q.test_sheet_id, (questionCounts.get(q.test_sheet_id) ?? 0) + 1);
    });
    (aRes.data ?? []).forEach((a) => {
      assignedCounts.set(a.test_sheet_id, (assignedCounts.get(a.test_sheet_id) ?? 0) + 1);
      if (a.status === "graded") {
        gradedCounts.set(a.test_sheet_id, (gradedCounts.get(a.test_sheet_id) ?? 0) + 1);
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">시험 관리</h1>
          <p className="text-muted-foreground text-sm">
            시험지를 만들고, 학생에게 배정하고, 답안을 마킹하면 자동으로 리포트가 생성돼요.
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
              <TableHead>시험일</TableHead>
              <TableHead>문항</TableHead>
              <TableHead>배정 / 채점</TableHead>
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
              (sheets ?? []).map((s) => {
                const qCount = questionCounts.get(s.id) ?? 0;
                const aCount = assignedCounts.get(s.id) ?? 0;
                const gCount = gradedCounts.get(s.id) ?? 0;
                return (
                  <TableRow key={s.id} className="cursor-pointer">
                    <TableCell className="pl-4 font-medium">
                      <Link
                        href={`/tests/${s.id}`}
                        className="hover:underline"
                      >
                        {s.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.target_school
                        ? `${s.target_school}${s.target_grade ? ` · ${s.target_grade}학년` : ""}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.test_date ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{qCount}문항</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-1.5 text-sm">
                        <Badge variant={aCount > 0 ? "primary" : "outline"}>
                          {aCount}명 배정
                        </Badge>
                        <span className="text-muted-foreground">/</span>
                        <Badge
                          variant={
                            gCount === aCount && aCount > 0
                              ? "success"
                              : "outline"
                          }
                        >
                          {gCount}명 채점
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground pr-4 text-right">
                      {formatDate(s.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
