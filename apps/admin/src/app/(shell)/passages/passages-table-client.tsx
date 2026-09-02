"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  PASSAGE_SOURCE,
  PASSAGE_SOURCE_LABEL,
  type PassageSource,
} from "@ipsi/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type PassageRow = {
  id: string;
  title: string;
  source_type: PassageSource;
  unit_major: string;
  unit_minor: string | null;
  created_at: string;
  question_count: number;
};

export function PassagesTableClient({ rows }: { rows: PassageRow[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<PassageSource | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim();
    return rows.filter((r) => {
      if (source !== "all" && r.source_type !== source) return false;
      if (!q) return true;
      return [r.title, r.unit_major, r.unit_minor ?? ""].some((v) =>
        v.includes(q),
      );
    });
  }, [rows, query, source]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목/단원 검색"
            className="pl-9"
          />
        </div>
        <Tabs
          value={source}
          onValueChange={(v) => setSource(v as PassageSource | "all")}
        >
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            {PASSAGE_SOURCE.map((s) => (
              <TabsTrigger key={s} value={s}>
                {PASSAGE_SOURCE_LABEL[s].replace(/\(.+?\)/, "")}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <p className="text-muted-foreground text-xs">
        {filtered.length} / {rows.length}건
      </p>

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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  {query
                    ? `"${query}" 검색 결과 없음`
                    : "아직 등록된 지문이 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/passages/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="primary">
                      {PASSAGE_SOURCE_LABEL[p.source_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.unit_major}
                    {p.unit_minor ? ` · ${p.unit_minor}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.question_count}문항</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground pr-4 text-right text-sm">
                    {new Date(p.created_at).toLocaleDateString("ko-KR")}
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
