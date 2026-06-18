"use client";

import { useMemo, useState, useTransition } from "react";
import { Calendar, CheckCircle2, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  publishFeedbackAction,
  saveFeedbackDraftAction,
  unpublishFeedbackAction,
} from "./actions";

type Journal = {
  id: string;
  student_id: string;
  journal_date: string;
  content: string;
  submitted_at: string;
  updated_at: string;
};
type Student = {
  id: string;
  full_name: string;
  school: string | null;
  grade: number | null;
};
type Feedback = {
  journal_id: string;
  overall_comment: string | null;
  better_than_yesterday: string | null;
  worse_than_yesterday: string | null;
  must_fix_tomorrow: string | null;
  publish_at: string | null;
  updated_at: string;
};

type Row = {
  journal: Journal;
  student?: Student;
  feedback?: Feedback;
};

type TabValue = "unanswered" | "draft" | "published" | "all";

export function JournalsTable({
  rows,
  unansweredCount,
  draftCount,
  publishedCount,
}: {
  rows: Row[];
  unansweredCount: number;
  draftCount: number;
  publishedCount: number;
}) {
  const [tab, setTab] = useState<TabValue>("unanswered");
  const [selected, setSelected] = useState<Row | null>(null);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((r) => {
      if (tab === "unanswered") return !r.feedback;
      if (tab === "draft") return r.feedback && !r.feedback.publish_at;
      if (tab === "published") return r.feedback && r.feedback.publish_at;
      return true;
    });
  }, [rows, tab]);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="unanswered">미답변 {unansweredCount}</TabsTrigger>
          <TabsTrigger value="draft">초안 {draftCount}</TabsTrigger>
          <TabsTrigger value="published">발행 {publishedCount}</TabsTrigger>
          <TabsTrigger value="all">전체 {rows.length}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="bg-background rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">날짜</TableHead>
              <TableHead>학생</TableHead>
              <TableHead>일지 내용</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="pr-4 text-right">제출</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  표시할 일지가 없어요.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.journal.id}
                  data-state={selected?.journal.id === r.journal.id ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => setSelected(r)}
                >
                  <TableCell className="pl-4 font-medium tabular-nums">
                    {r.journal.journal_date}
                  </TableCell>
                  <TableCell>
                    {r.student ? (
                      <div>
                        <p className="font-medium">{r.student.full_name}</p>
                        <p className="text-muted-foreground text-xs">
                          {r.student.school ?? ""}
                          {r.student.grade ? ` · ${r.student.grade}학년` : ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-md truncate text-sm">
                    {r.journal.content}
                  </TableCell>
                  <TableCell>
                    <FeedbackBadge feedback={r.feedback} />
                  </TableCell>
                  <TableCell className="text-muted-foreground pr-4 text-right text-xs">
                    {formatDateTime(r.journal.submitted_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <FeedbackDrawer
        row={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function FeedbackBadge({ feedback }: { feedback?: Feedback }) {
  if (!feedback) return <Badge variant="warning">미답변</Badge>;
  if (!feedback.publish_at) return <Badge variant="outline">초안</Badge>;
  const date = new Date(feedback.publish_at);
  const isFuture = date > new Date();
  if (isFuture) {
    return (
      <Badge variant="primary">
        예약 {formatDateTime(feedback.publish_at)}
      </Badge>
    );
  }
  return (
    <Badge variant="success">
      <CheckCircle2 className="size-3" /> 발행됨
    </Badge>
  );
}

function FeedbackDrawer({
  row,
  onClose,
}: {
  row: Row | null;
  onClose: () => void;
}) {
  const open = row !== null;
  const journalId = row?.journal.id ?? null;

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [fields, setFields] = useState({
    overall_comment: "",
    better_than_yesterday: "",
    worse_than_yesterday: "",
    must_fix_tomorrow: "",
  });

  // 새 row 열릴 때 fields 초기화
  if (journalId !== lastId) {
    setLastId(journalId);
    setError(null);
    setFields({
      overall_comment: row?.feedback?.overall_comment ?? "",
      better_than_yesterday: row?.feedback?.better_than_yesterday ?? "",
      worse_than_yesterday: row?.feedback?.worse_than_yesterday ?? "",
      must_fix_tomorrow: row?.feedback?.must_fix_tomorrow ?? "",
    });
  }

  const update = (key: keyof typeof fields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.set("overall_comment", fields.overall_comment);
    fd.set("better_than_yesterday", fields.better_than_yesterday);
    fd.set("worse_than_yesterday", fields.worse_than_yesterday);
    fd.set("must_fix_tomorrow", fields.must_fix_tomorrow);
    return fd;
  };

  const handleSaveDraft = () => {
    if (!journalId) return;
    setError(null);
    startTransition(async () => {
      const r = await saveFeedbackDraftAction(journalId, null, buildFormData());
      if (!r.ok) setError(r.message);
    });
  };

  const handlePublish = () => {
    if (!journalId) return;
    setError(null);
    startTransition(async () => {
      const r = await publishFeedbackAction(journalId, null, buildFormData());
      if (r.ok) onClose();
      else setError(r.message);
    });
  };

  const handleUnpublish = () => {
    if (!journalId) return;
    setError(null);
    startTransition(async () => {
      const r = await unpublishFeedbackAction(journalId);
      if (!r.ok) setError(r.message);
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-xl">
        {row && (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-2">
                <Calendar className="text-muted-foreground size-4" />
                <SheetTitle className="font-mono tabular-nums">
                  {row.journal.journal_date}
                </SheetTitle>
                {row.feedback?.publish_at && (
                  <Badge
                    variant={
                      new Date(row.feedback.publish_at) > new Date()
                        ? "primary"
                        : "success"
                    }
                  >
                    {new Date(row.feedback.publish_at) > new Date()
                      ? `예약 ${formatDateTime(row.feedback.publish_at)}`
                      : "발행됨"}
                  </Badge>
                )}
              </div>
              <SheetDescription>
                {row.student?.full_name}
                {row.student?.school ? ` · ${row.student.school}` : ""}
                {row.student?.grade ? ` ${row.student.grade}학년` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="grid auto-rows-min gap-5">
                {/* 학생 일지 원문 */}
                <section className="space-y-2">
                  <h3 className="text-foreground text-sm font-semibold">
                    학생 일지
                  </h3>
                  <div className="bg-muted/40 rounded-md border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {row.journal.content}
                  </div>
                </section>

                {/* 4필드 피드백 */}
                <section className="space-y-4">
                  <h3 className="text-foreground text-sm font-semibold">
                    원장 피드백
                  </h3>

                  <FieldBlock
                    label="종합 코멘트"
                    value={fields.overall_comment}
                    onChange={(v) => update("overall_comment", v)}
                  />
                  <FieldBlock
                    label="어제보다 나아진 점"
                    value={fields.better_than_yesterday}
                    onChange={(v) => update("better_than_yesterday", v)}
                  />
                  <FieldBlock
                    label="어제보다 못한 점"
                    value={fields.worse_than_yesterday}
                    onChange={(v) => update("worse_than_yesterday", v)}
                  />
                  <FieldBlock
                    label="★ 내일 반드시 고칠 것"
                    description="학생 화면 최상단에 큰 글씨로 박혀요"
                    value={fields.must_fix_tomorrow}
                    onChange={(v) => update("must_fix_tomorrow", v)}
                    accent
                  />
                </section>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <SheetFooter className="border-t">
              <div className="flex w-full items-center justify-between gap-2">
                {row.feedback?.publish_at ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnpublish}
                    disabled={pending}
                  >
                    <XCircle className="size-4" /> 발행 취소
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={pending}
                  >
                    초안 저장
                  </Button>
                  <Button onClick={handlePublish} disabled={pending}>
                    <Send className="size-4" />
                    {pending ? "처리 중..." : "발행 (내일 06:00 KST)"}
                  </Button>
                </div>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FieldBlock({
  label,
  description,
  value,
  onChange,
  accent,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  accent?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <Label className={accent ? "text-primary font-bold" : ""}>{label}</Label>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={accent ? "내일 핵심 한 줄로" : ""}
      />
    </div>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
