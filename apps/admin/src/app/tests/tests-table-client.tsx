"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownUp, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SheetRow = {
  id: string;
  title: string;
  target_school: string | null;
  target_grade: number | null;
  open_at: string | null;
  due_at: string | null;
  allow_retake: boolean;
  created_at: string;
  question_count: number;
  assigned_count: number;
};

type SortKey =
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc"
  | "due_asc";

export function TestsTableClient({ sheets }: { sheets: SheetRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("created_desc");

  const filtered = useMemo(() => {
    const q = query.trim();
    let arr = q
      ? sheets.filter((s) =>
          [s.title, s.target_school ?? ""].some((v) => v.includes(q)),
        )
      : [...sheets];

    arr.sort((a, b) => {
      switch (sort) {
        case "created_asc":
          return a.created_at.localeCompare(b.created_at);
        case "title_asc":
          return a.title.localeCompare(b.title, "ko");
        case "title_desc":
          return b.title.localeCompare(a.title, "ko");
        case "due_asc":
          // due_at null은 뒤로
          if (!a.due_at && !b.due_at) return 0;
          if (!a.due_at) return 1;
          if (!b.due_at) return -1;
          return a.due_at.localeCompare(b.due_at);
        case "created_desc":
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
    return arr;
  }, [sheets, query, sort]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="시험지 제목/학교 검색"
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <ArrowDownUp className="text-muted-foreground size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">최근 생성순</SelectItem>
            <SelectItem value="created_asc">오래된 생성순</SelectItem>
            <SelectItem value="due_asc">마감 가까운 순</SelectItem>
            <SelectItem value="title_asc">제목 가나다</SelectItem>
            <SelectItem value="title_desc">제목 역순</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-muted-foreground text-xs">
        {filtered.length} / {sheets.length}건
      </p>

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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground h-24 text-center"
                >
                  {query
                    ? `"${query}" 검색 결과가 없습니다.`
                    : "아직 시험지가 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
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
                    <Badge variant="outline">{s.question_count}문항</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.assigned_count > 0 ? "primary" : "outline"}>
                      {s.assigned_count}명
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
