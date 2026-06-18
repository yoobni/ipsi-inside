import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { PASSAGE_SOURCE_LABEL, type PassageSource } from "@ipsi/types";
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

export default async function PassagesListPage() {
  const supabase = await createServerSupabaseClient();

  const { data: passages } = await supabase
    .from("passages")
    .select("id, title, source_type, unit_major, unit_minor, created_at")
    .order("created_at", { ascending: false });

  // 지문별 문항 수
  const passageIds = (passages ?? []).map((p) => p.id);
  const counts = new Map<string, number>();
  if (passageIds.length > 0) {
    const { data: qs } = await supabase
      .from("questions")
      .select("passage_id")
      .in("passage_id", passageIds);
    (qs ?? []).forEach((q) => {
      counts.set(q.passage_id, (counts.get(q.passage_id) ?? 0) + 1);
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">지문 / 문항</h1>
          <p className="text-muted-foreground text-sm">
            수능 국어 지문과 문항을 등록해두면 시험지 만들 때 재사용할 수 있어요.
          </p>
        </div>
        <Button asChild>
          <Link href="/passages/new">
            <Plus className="size-4" />새 지문 등록
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">제목</TableHead>
              <TableHead>분류</TableHead>
              <TableHead>단원</TableHead>
              <TableHead>문항</TableHead>
              <TableHead className="pr-4 text-right">등록일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(passages ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  아직 등록된 지문이 없습니다. 우측 상단 [새 지문 등록]을 눌러 시작하세요.
                </TableCell>
              </TableRow>
            ) : (
              (passages ?? []).map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
                  <TableCell className="pl-4 font-medium">
                    <Link
                      href={`/passages/${p.id}`}
                      className="hover:underline"
                    >
                      {p.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="primary">
                      {PASSAGE_SOURCE_LABEL[p.source_type as PassageSource]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.unit_major}
                    {p.unit_minor ? ` · ${p.unit_minor}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {counts.get(p.id) ?? 0}문항
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground pr-4 text-right text-sm">
                    {formatDate(p.created_at)}
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
