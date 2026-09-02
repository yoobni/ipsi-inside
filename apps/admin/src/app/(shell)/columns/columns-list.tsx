"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  toggleColumnPublishAction,
  deleteColumnAction,
} from "./actions";

export type ColumnRow = {
  id: string;
  title: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  read_count: number;
};

export function ColumnsList({
  rows,
  studentTotal,
}: {
  rows: ColumnRow[];
  studentTotal: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const togglePublish = (row: ColumnRow) => {
    startTransition(async () => {
      const res = await toggleColumnPublishAction(row.id, !row.is_published);
      if (res.ok) router.refresh();
    });
  };

  const remove = (row: ColumnRow) => {
    if (!confirm(`"${row.title}" 칼럼을 삭제할까요? 학생 읽음 기록도 함께 지워져요.`))
      return;
    startTransition(async () => {
      const res = await deleteColumnAction(row.id);
      if (res.ok) router.refresh();
    });
  };

  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed py-16 text-center text-sm">
        아직 칼럼이 없어요. [새 칼럼]으로 첫 글을 올려보세요.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-3"
        >
          <Link
            href={`/columns/${row.id}`}
            className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
          >
            <BookOpen className="text-muted-foreground size-4 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.title}</p>
              <p className="text-muted-foreground text-xs">
                {row.is_published ? (
                  <>
                    읽음 {row.read_count}
                    {studentTotal > 0 ? ` / ${studentTotal}명` : "명"}
                  </>
                ) : (
                  "초안"
                )}
              </p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {row.is_published ? (
              <Badge variant="success">발행됨</Badge>
            ) : (
              <Badge variant="outline">초안</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => togglePublish(row)}
            >
              {row.is_published ? "발행 취소" : "발행"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              onClick={() => remove(row)}
              aria-label="삭제"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
