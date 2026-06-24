"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  EyeOff,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SchedulePublishButton } from "@/components/schedule-publish-popover";
import {
  deleteAnnouncementAction,
  togglePublishAction,
  upsertAnnouncementAction,
} from "./actions";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string | null;
  audience: "all" | "student" | "parent";
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
};

const AUDIENCE_LABEL: Record<AnnouncementRow["audience"], string> = {
  all: "전체",
  student: "학생만",
  parent: "학부모만",
};

export function AnnouncementsClient({ rows }: { rows: AnnouncementRow[] }) {
  const [editing, setEditing] = useState<AnnouncementRow | "new" | null>(null);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />새 공지
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            등록된 공지가 없어요.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <RowItem row={r} onEdit={() => setEditing(r)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Drawer
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function RowItem({
  row,
  onEdit,
}: {
  row: AnnouncementRow;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      const r = await togglePublishAction(row.id, !row.is_published);
      if (!r.ok) setError(r.message);
    });
  };
  const handleDelete = () => {
    if (!confirm("이 공지를 삭제할까요?")) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteAnnouncementAction(row.id);
      if (!r.ok) setError(r.message);
    });
  };

  const isExpired =
    row.expires_at != null && new Date(row.expires_at) < new Date();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">{row.title}</h3>
          <Badge variant={row.is_published ? "success" : "outline"}>
            {row.is_published ? "발행" : "초안"}
          </Badge>
          <Badge variant="primary">{AUDIENCE_LABEL[row.audience]}</Badge>
          {isExpired && <Badge variant="warning">만료</Badge>}
        </div>
        {row.body && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
            {row.body}
          </p>
        )}
        <p className="text-muted-foreground mt-1 text-[10px]">
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
        {!row.is_published && (
          <SchedulePublishButton
            onPublish={(iso) => togglePublishAction(row.id, true, iso)}
            label="예약"
          />
        )}
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" />
          편집
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

function Drawer({
  editing,
  onClose,
}: {
  editing: AnnouncementRow | "new" | null;
  onClose: () => void;
}) {
  const open = editing !== null;
  const row = editing && editing !== "new" ? editing : null;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "student" | "parent">("all");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [lastId, setLastId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const editingId = row?.id ?? null;
  if (editingId !== lastId) {
    setLastId(editingId);
    setTitle(row?.title ?? "");
    setBody(row?.body ?? "");
    setAudience(row?.audience ?? "all");
    setExpiresAt(isoToLocal(row?.expires_at ?? null));
    setError(null);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("body", body);
    fd.set("audience", audience);
    fd.set("expires_at", expiresAt ? localToIso(expiresAt) ?? "" : "");
    startTransition(async () => {
      const r = await upsertAnnouncementAction(editingId, null, fd);
      if (r.ok) onClose();
      else setError(r.message);
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{editingId ? "공지 편집" : "새 공지"}</SheetTitle>
          <SheetDescription>
            제목과 내용을 입력하고 대상을 선택하세요. 발행은 목록에서 [발행] 버튼으로.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 pb-4"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">제목 *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예) 추석 연휴 휴원 안내"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">내용</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="공지 본문"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">대상</Label>
              <Select
                value={audience}
                onValueChange={(v) =>
                  setAudience(v as "all" | "student" | "parent")
                }
              >
                <SelectTrigger id="audience" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="student">학생만</SelectItem>
                  <SelectItem value="parent">학부모만</SelectItem>
                </SelectContent>
              </Select>
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
                만료 후엔 학생/학부모 홈 배너에서 자동 제거돼요.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <SheetFooter className="border-t mt-6 -mx-4 px-4 pt-4">
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={pending}
                className="flex-1"
              >
                취소
              </Button>
              <Button type="submit" disabled={pending} className="flex-1">
                <CheckCircle2 className="size-4" />
                {pending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
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
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}
