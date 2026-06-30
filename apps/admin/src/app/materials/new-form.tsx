"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileUp, Upload } from "lucide-react";
import {
  MATERIAL_AUDIENCE_LABEL,
  MAX_MATERIAL_BYTES,
  type MaterialAudience,
} from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMaterialAction } from "./actions";
import { uploadPdfAction } from "./upload-pdf";

const AUDIENCE_HINT: Record<MaterialAudience, string> = {
  all: "활성 학생 + 학부모 전원이 받아요.",
  student: "활성 학생 전원 + 자녀가 학생인 학부모가 받아요.",
  parent: "활성 학부모 전원만 받아요. (학생에겐 노출 안 됨)",
  targeted:
    "발행 후 상세 화면에서 학교/학생을 선택해 배정해요. 자녀의 학부모도 함께 노출돼요.",
  group:
    "선택한 그룹(반)의 학생과 그 학부모가 받아요. 그룹 멤버가 바뀌면 노출 대상도 자동으로 따라가요.",
};

export type GroupOption = { id: string; name: string; member_count: number };

export function NewMaterialForm({ groups }: { groups: GroupOption[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<MaterialAudience>("targeted");
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set());
  const [expiresAt, setExpiresAt] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggleGroup = (id: string) =>
    setGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError("PDF 파일을 1개 이상 선택해주세요.");
      return;
    }
    for (const f of files) {
      if (f.size > MAX_MATERIAL_BYTES) {
        setError(`${f.name}: 30MB 이하의 PDF만 업로드 가능합니다.`);
        return;
      }
      if (f.type !== "application/pdf") {
        setError(`${f.name}: PDF 파일만 업로드 가능합니다.`);
        return;
      }
    }
    if (audience === "group" && groupIds.size === 0) {
      setError("대상 그룹을 최소 1개 선택해주세요.");
      return;
    }
    setError(null);

    startTransition(async () => {
      // 파일별 업로드 (순서 유지)
      const uploaded: {
        storage_path: string;
        file_name: string;
        file_size_bytes: number;
      }[] = [];
      for (const f of files) {
        const uploadFd = new FormData();
        uploadFd.set("file", f);
        const up = await uploadPdfAction(uploadFd);
        if (!up.ok) {
          setError(`${f.name}: ${up.message}`);
          return;
        }
        uploaded.push({
          storage_path: up.storage_path,
          file_name: up.file_name,
          file_size_bytes: up.file_size_bytes,
        });
      }

      const fd = new FormData();
      fd.set("title", title.trim());
      fd.set("description", description.trim());
      fd.set("audience", audience);
      fd.set("expires_at", expiresAt ? localToIso(expiresAt) ?? "" : "");
      fd.set("files", JSON.stringify(uploaded));
      if (audience === "group") {
        fd.set("group_ids", JSON.stringify(Array.from(groupIds)));
      }

      const r = await createMaterialAction(null, fd);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.push(`/materials/${r.id}`);
    });
  };

  const totalMb = files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-md border bg-card p-5">
      <div className="space-y-2">
        <Label htmlFor="title">제목 *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예) 9월 모의고사 해설 PDF"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">설명 (선택)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="자료 설명. 알림 본문으로도 노출돼요."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="audience">배부 대상 *</Label>
        <Select
          value={audience}
          onValueChange={(v) => setAudience(v as MaterialAudience)}
        >
          <SelectTrigger id="audience" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="group">
              {MATERIAL_AUDIENCE_LABEL.group}
            </SelectItem>
            <SelectItem value="targeted">
              {MATERIAL_AUDIENCE_LABEL.targeted} (학교/학생 선택)
            </SelectItem>
            <SelectItem value="all">{MATERIAL_AUDIENCE_LABEL.all}</SelectItem>
            <SelectItem value="student">
              {MATERIAL_AUDIENCE_LABEL.student}
            </SelectItem>
            <SelectItem value="parent">
              {MATERIAL_AUDIENCE_LABEL.parent}
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">{AUDIENCE_HINT[audience]}</p>

        {audience === "group" && (
          <div className="mt-2 space-y-1.5">
            {groups.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-xs">
                만든 그룹이 없어요. [그룹(반)] 메뉴에서 먼저 그룹을 만들어주세요.
              </p>
            ) : (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {groups.map((g) => (
                  <li key={g.id}>
                    <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={groupIds.has(g.id)}
                        onChange={() => toggleGroup(g.id)}
                        className="size-4 accent-current"
                      />
                      <span className="flex-1 text-sm font-medium">{g.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {g.member_count}명
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="expires">만료 일시 (선택)</Label>
        <Input
          id="expires"
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          만료 후엔 학생/학부모 자료 목록에서 자동 제거돼요.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">PDF 파일 * (여러 개 가능, 각 ≤30MB)</Label>
        <div className="border-input flex items-center gap-3 rounded-md border border-dashed bg-background p-4">
          <FileUp className="text-muted-foreground size-5" />
          <input
            id="file"
            type="file"
            accept="application/pdf"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="flex-1 text-sm"
            required
          />
        </div>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="text-muted-foreground flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate">
                  {i + 1}. {f.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  {(f.size / 1024 / 1024).toFixed(1)}MB
                </span>
              </li>
            ))}
            <li className="text-muted-foreground text-xs font-medium">
              총 {files.length}개 · {totalMb.toFixed(1)}MB
            </li>
          </ul>
        )}
        <p className="text-muted-foreground text-xs">
          여러 PDF를 한 번에 올리면 한 자료(세트)로 묶여서 배부돼요.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => history.back()}
          disabled={pending}
        >
          취소
        </Button>
        <Button type="submit" disabled={pending || files.length === 0}>
          <Upload className="size-4" />
          {pending ? "업로드 중..." : "업로드 & 저장"}
        </Button>
      </div>
    </form>
  );
}

function localToIso(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}
