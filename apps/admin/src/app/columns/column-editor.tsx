"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RichEditor } from "@/components/rich-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { upsertColumnAction } from "./actions";

export function ColumnEditor({
  columnId,
  initialTitle = "",
  initialBody = "",
}: {
  columnId?: string;
  initialTitle?: string;
  initialBody?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("body", body);
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
        <Label>본문</Label>
        <RichEditor
          value={body}
          onChange={setBody}
          placeholder="국어 개념·독해 노하우를 적어주세요."
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button asChild variant="ghost" size="lg">
          <Link href="/columns">취소</Link>
        </Button>
        <Button size="lg" onClick={save} disabled={pending}>
          {pending ? "저장 중..." : columnId ? "저장" : "작성"}
        </Button>
      </div>
    </div>
  );
}
