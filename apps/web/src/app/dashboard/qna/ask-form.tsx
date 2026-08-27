"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createQuestionAction } from "./actions";
import { uploadQnaImageAction } from "./upload-image";

export type Category = {
  id: string;
  label: string;
  placeholder: string | null;
  needs_reference: boolean;
};

export function AskForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [reference, setReference] = useState("");
  const [questionNo, setQuestionNo] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const selected = categories.find((c) => c.id === categoryId);
  const needsRef = selected?.needs_reference ?? false;

  const onPickImage = async (file: File) => {
    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadQnaImageAction(fd);
    setUploading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setImagePath(res.image_path);
    setImageName(file.name);
  };

  const submit = () => {
    setError(null);
    const fd = new FormData();
    fd.set("categoryId", categoryId);
    // 교재/문항은 needs_reference 카테고리에서만 의미가 있다. 다른 분류로
    // 바꾼 뒤에도 이전에 입력한 값이 남아 저장되지 않도록 여기서 거른다.
    fd.set("referenceLabel", needsRef ? reference : "");
    fd.set("questionNo", needsRef ? questionNo : "");
    fd.set("body", body);
    if (imagePath) fd.set("imagePath", imagePath);
    startTransition(async () => {
      const res = await createQuestionAction(null, fd);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setBody("");
      setReference("");
      setQuestionNo("");
      setImagePath(null);
      setImageName(null);
      router.refresh();
    });
  };

  return (
    <div className="border-hairline bg-surface space-y-4 rounded-[14px] border p-5">
      <p className="font-bold">질문하기</p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 분류 — 세그먼트 */}
      <div className="space-y-1.5">
        <Label>분류</Label>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={
                "rounded-full border px-3 py-1 text-sm transition-colors " +
                (c.id === categoryId
                  ? "border-primary bg-primary text-primary-foreground font-bold"
                  : "border-hairline text-muted-foreground hover:text-foreground")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 교재/문항 — needs_reference 카테고리에서만 */}
      {needsRef && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ref">교재 / 시험지</Label>
            <Input
              id="ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="예: 주간지 3호 / 6월 모의고사"
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qno">문항 번호</Label>
            <Input
              id="qno"
              value={questionNo}
              onChange={(e) => setQuestionNo(e.target.value)}
              placeholder="예: 17번"
              maxLength={20}
            />
          </div>
        </div>
      )}

      {/* 본문 — placeholder가 카테고리별 가이드라인 */}
      <div className="space-y-1.5">
        <Label htmlFor="qbody">질문</Label>
        <textarea
          id="qbody"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder={selected?.placeholder ?? "궁금한 점을 적어주세요."}
          className="border-hairline bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>

      {/* 사진 첨부 */}
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickImage(f);
            e.target.value = "";
          }}
        />
        {imageName ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="max-w-[180px] truncate">📷 {imageName}</span>
            <button
              type="button"
              onClick={() => {
                setImagePath(null);
                setImageName(null);
              }}
              aria-label="첨부 제거"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            {uploading ? "올리는 중..." : "사진 첨부"}
          </Button>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={submit}
          disabled={pending || uploading || body.trim().length < 5}
        >
          {pending ? "보내는 중..." : "질문 보내기"}
        </Button>
      </div>
    </div>
  );
}
