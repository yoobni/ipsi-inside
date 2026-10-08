"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RichEditor } from "@/components/rich-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { upsertColumnAction } from "./actions";

export type CategoryChoice = { id: string; label: string; archived: boolean };

// Radix Select는 빈 문자열 value를 못 쓴다 — 미분류는 센티널로.
const NONE = "__none__";

export function ColumnEditor({
  columnId,
  initialTitle = "",
  initialBody = "",
  initialCategoryId = null,
  categories,
}: {
  columnId?: string;
  initialTitle?: string;
  initialBody?: string;
  initialCategoryId?: string | null;
  categories: CategoryChoice[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId ?? NONE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 보관된 카테고리는 새로 고를 수 없지만, 이 칼럼이 이미 달고 있는 것은 보여준다.
  const choices = categories.filter((c) => !c.archived || c.id === initialCategoryId);

  const save = () => {
    setError(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("body", body);
    fd.set("categoryId", categoryId === NONE ? "" : categoryId);
    startTransition(async () => {
      const res = await upsertColumnAction(columnId ?? null, null, fd);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      // 새로 만들었으면 편집 화면으로, 편집이면 목록으로
      router.push(columnId ? "/columns" : `/columns/${res.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/columns">
            <ChevronLeft className="size-4" />
            목록
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
        <div className="space-y-2">
          <Label htmlFor="col-title">제목</Label>
          <Input
            id="col-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="칼럼 제목"
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="col-category">카테고리</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="col-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>미분류</SelectItem>
              {choices.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                  {c.archived ? " (보관됨)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>본문</Label>
        <RichEditor
          value={body}
          onChange={setBody}
          placeholder="국어 개념·독해 노하우를 적어주세요."
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" size="lg">
          <Link href="/columns">취소</Link>
        </Button>
        <Button size="lg" onClick={save} disabled={pending}>
          {pending ? "저장 중..." : columnId ? "저장" : "작성"}
        </Button>
      </div>
    </div>
  );
}
