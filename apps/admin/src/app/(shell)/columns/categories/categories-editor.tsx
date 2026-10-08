"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  upsertColumnCategoryAction,
  archiveColumnCategoryAction,
} from "../actions";

export type CategoryRow = {
  id: string;
  label: string;
  archived: boolean;
};

export function CategoriesEditor({ rows }: { rows: CategoryRow[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {rows.map((r) => (
          <CategoryItem key={r.id} row={r} />
        ))}
      </ul>

      {creating ? (
        <CategoryForm onDone={() => setCreating(false)} />
      ) : (
        <Button variant="outline" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          카테고리 추가
        </Button>
      )}
    </div>
  );
}

function CategoryItem({ row }: { row: CategoryRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return <CategoryForm row={row} onDone={() => setEditing(false)} />;
  }

  return (
    <li
      className={
        "rounded-md border bg-card p-4 " + (row.archived ? "opacity-50" : "")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-bold">{row.label}</span>
          {row.archived && <Badge variant="outline">보관됨</Badge>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            편집
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await archiveColumnCategoryAction(row.id, !row.archived);
                if (res.ok) router.refresh();
              })
            }
          >
            {row.archived ? "복구" : "보관"}
          </Button>
        </div>
      </div>
    </li>
  );
}

function CategoryForm({
  row,
  onDone,
}: {
  row?: CategoryRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(row?.label ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    const fd = new FormData();
    fd.set("label", label);
    startTransition(async () => {
      const res = await upsertColumnCategoryAction(row?.id ?? null, null, fd);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-md border bg-card p-4">
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="space-y-1.5">
        <Label>카테고리 이름</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="예: 문학 / 독서 / 언어와 매체 / 공부법 / 입시·공지"
          maxLength={20}
          autoFocus
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          취소
        </Button>
        <Button onClick={save} disabled={pending || label.trim().length === 0}>
          {pending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}
