"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { upsertCategoryAction, archiveCategoryAction } from "../actions";

export type CategoryRow = {
  id: string;
  label: string;
  placeholder: string | null;
  needs_reference: boolean;
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
          분류 추가
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold">{row.label}</span>
            {row.needs_reference && <Badge variant="outline">교재/문항 권장</Badge>}
            {row.archived && <Badge variant="outline">보관됨</Badge>}
          </div>
          {row.placeholder && (
            <p className="text-muted-foreground text-xs">{row.placeholder}</p>
          )}
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
                const res = await archiveCategoryAction(row.id, !row.archived);
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
  const [placeholder, setPlaceholder] = useState(row?.placeholder ?? "");
  const [needsRef, setNeedsRef] = useState(row?.needs_reference ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    const fd = new FormData();
    fd.set("label", label);
    fd.set("placeholder", placeholder);
    fd.set("needsReference", needsRef ? "true" : "false");
    startTransition(async () => {
      const res = await upsertCategoryAction(row?.id ?? null, null, fd);
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
        <Label>분류 이름</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="예: 학습 / 수업 / 숙제 / 일상"
          maxLength={20}
        />
      </div>
      <div className="space-y-1.5">
        <Label>안내 문구 (가이드라인)</Label>
        <textarea
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="학생 질문 입력창에 흐리게 뜨는 예시 문구"
          className="focus-visible:ring-ring w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={needsRef}
          onChange={(e) => setNeedsRef(e.target.checked)}
        />
        교재/문항 번호 입력 칸 표시
      </label>
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
