"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  EyeOff,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import {
  MATERIAL_AUDIENCE_LABEL,
  type MaterialAudience,
} from "@ipsi/types";
import { formatBytes } from "@ipsi/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteMaterialAction,
  togglePublishMaterialAction,
} from "./actions";

export type MaterialRow = {
  id: string;
  title: string;
  audience: MaterialAudience;
  file_count: number;
  total_bytes: number;
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  target_count: number;
};

type AudienceFilter = "_any" | MaterialAudience;
type PublishFilter = "_any" | "published" | "draft";

export function MaterialsTableClient({ rows }: { rows: MaterialRow[] }) {
  const [query, setQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("_any");
  const [publishFilter, setPublishFilter] = useState<PublishFilter>("_any");

  const filtered = useMemo(() => {
    const q = query.trim();
    return rows.filter((r) => {
      if (q && !r.title.includes(q)) return false;
      if (audienceFilter !== "_any" && r.audience !== audienceFilter)
        return false;
      if (publishFilter === "published" && !r.is_published) return false;
      if (publishFilter === "draft" && r.is_published) return false;
      return true;
    });
  }, [rows, query, audienceFilter, publishFilter]);

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목 / 파일명 검색"
            className="pl-8"
          />
        </div>
        <Select
          value={audienceFilter}
          onValueChange={(v) => setAudienceFilter(v as AudienceFilter)}
        >
          <SelectTrigger className="sm:w-36">
            <SelectValue placeholder="대상" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_any">전체 대상</SelectItem>
            <SelectItem value="all">전체 (학생+학부모)</SelectItem>
            <SelectItem value="student">학생 광역</SelectItem>
            <SelectItem value="parent">학부모 광역</SelectItem>
            <SelectItem value="targeted">핀포인트</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={publishFilter}
          onValueChange={(v) => setPublishFilter(v as PublishFilter)}
        >
          <SelectTrigger className="sm:w-32">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_any">전체 상태</SelectItem>
            <SelectItem value="published">발행</SelectItem>
            <SelectItem value="draft">초안</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            {rows.length === 0
              ? "등록된 자료가 없어요. 새 자료를 업로드해보세요."
              : "조건에 맞는 자료가 없어요."}
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <RowItem row={r} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function RowItem({ row }: { row: MaterialRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    if (row.is_published && !confirm("이 자료의 발행을 내릴까요?")) return;
    setError(null);
    startTransition(async () => {
      const r = await togglePublishMaterialAction(row.id, !row.is_published);
      if (!r.ok) setError(r.message);
    });
  };
  const handleDelete = () => {
    if (
      !confirm(
        "이 자료를 삭제할까요? 학생/학부모는 더 이상 다운로드할 수 없게 돼요.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await deleteMaterialAction(row.id);
      if (!r.ok) setError(r.message);
    });
  };

  const isExpired =
    row.expires_at != null && new Date(row.expires_at) < new Date();
  const totalSize = formatBytes(row.total_bytes);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">{row.title}</h3>
          <Badge variant={row.is_published ? "success" : "outline"}>
            {row.is_published ? "발행" : "초안"}
          </Badge>
          <Badge variant="primary">
            {MATERIAL_AUDIENCE_LABEL[row.audience]}
          </Badge>
          {row.audience === "targeted" && (
            <Badge variant="outline">{row.target_count}명 배정</Badge>
          )}
          {isExpired && <Badge variant="warning">만료</Badge>}
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          파일 {row.file_count}개 · {totalSize}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[10px]">
          {row.published_at
            ? `발행 ${formatDt(row.published_at)}`
            : `생성 ${formatDt(row.created_at)}`}
          {row.expires_at && ` · 만료 ${formatDt(row.expires_at)}`}
        </p>
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggle}
          disabled={pending}
        >
          {row.is_published ? (
            <>
              <EyeOff className="size-3.5" />
              내림
            </>
          ) : (
            <>
              <Send className="size-3.5" />
              발행
            </>
          )}
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/materials/${row.id}`}>
            상세 <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDelete}
          disabled={pending}
          className="size-8"
          aria-label="삭제"
        >
          <Trash2 className="text-destructive size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function formatDt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
