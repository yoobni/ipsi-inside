"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Puzzle, Trash2 } from "lucide-react";
import { DRILL_KIND_LABEL, type DrillKind } from "@ipsi/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteDrillAction, toggleDrillPublishAction } from "./actions";

export type DrillRow = {
  id: string;
  title: string;
  kind: DrillKind;
  area_label: string | null;
  work_title: string | null;
  is_published: boolean;
  item_count: number;
  attempts: number;
  accuracy: number | null;
};

export function DrillsList({ rows }: { rows: DrillRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = (row: DrillRow) =>
    startTransition(async () => {
      const r = await toggleDrillPublishAction(row.id, !row.is_published);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  const remove = (row: DrillRow) => {
    if (!confirm(`"${row.title}" 훈련을 삭제할까요? 학생 풀이 기록도 함께 지워져요.`)) return;
    startTransition(async () => {
      const r = await deleteDrillAction(row.id);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  };

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
          <Link href={`/drills/${row.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
            <Puzzle className="text-muted-foreground size-4 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.title}</p>
              <p className="text-muted-foreground text-xs">
                {DRILL_KIND_LABEL[row.kind]} · {row.item_count}문항
                {row.area_label ? ` · ${row.area_label}` : ""}
                {row.work_title ? ` · ${row.work_title}` : ""}
                {row.attempts > 0 ? ` · 풀이 ${row.attempts}회 · 첫 시도 정답률 ${row.accuracy ?? 0}%` : ""}
              </p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {row.is_published ? <Badge variant="success">발행됨</Badge> : <Badge variant="outline">초안</Badge>}
            <Button variant="outline" size="sm" disabled={pending} onClick={() => toggle(row)}>
              {row.is_published ? "발행 취소" : "발행"}
            </Button>
            <Button variant="ghost" size="icon" disabled={pending} onClick={() => remove(row)} aria-label="삭제">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
