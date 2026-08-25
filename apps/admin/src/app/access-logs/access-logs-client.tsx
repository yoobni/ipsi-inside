"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { markReviewedAction } from "./actions";

export type LogRow = {
  id: string;
  action: string;
  actorName: string;
  targetName: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
};

/** 기록된 action → 사람이 읽는 말. 무엇을 한 기록인지가 한눈에 보여야 한다. */
const ACTION_LABEL: Record<string, string> = {
  "member.view": "회원 정보 열람",
  "member.approve": "가입 승인",
  "member.reject": "가입 반려",
  "attendance.export": "출결 CSV 내려받기",
  "test.export": "시험 결과 CSV 내려받기",
  "password.issue": "임시 비밀번호 발급",
  "proof.view": "인증사진 열람",
  "audit.review": "접속기록 점검",
};

/** 눈여겨봐야 하는 것 — 개인정보가 파일로 밖에 나가거나 계정을 건드린 기록. */
const SENSITIVE = new Set([
  "attendance.export",
  "test.export",
  "password.issue",
]);

const FILTERS = [
  { value: "", label: "전체" },
  { value: "member.view", label: "열람" },
  { value: "attendance.export", label: "출결 CSV" },
  { value: "test.export", label: "시험 CSV" },
  { value: "password.issue", label: "비밀번호 발급" },
];

export function AccessLogsClient({
  rows,
  days,
  actionFilter,
  lastReviewedAt,
  lastReviewerName,
}: {
  rows: LogRow[];
  days: number;
  actionFilter: string;
  lastReviewedAt: string | null;
  lastReviewerName: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const sensitiveCount = rows.filter((r) => SENSITIVE.has(r.action)).length;
  const reviewOverdue = isOverdue(lastReviewedAt);

  return (
    <div className="space-y-5">
      {/* 점검 상태 — 이 화면에 온 이유다. 목록보다 먼저 보여준다. */}
      <div className="rounded-md border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <ShieldCheck className="size-4" />
              월 1회 점검
            </p>
            <p className="text-muted-foreground text-xs">
              {lastReviewedAt ? (
                <>
                  마지막 점검: {formatKst(lastReviewedAt)}
                  {lastReviewerName ? ` · ${lastReviewerName}` : ""}
                  {reviewOverdue && (
                    <span className="text-primary font-semibold">
                      {" "}
                      — 한 달이 지났어요
                    </span>
                  )}
                </>
              ) : (
                <span className="text-primary font-semibold">
                  아직 점검 기록이 없어요
                </span>
              )}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="특이사항 (없으면 비워두세요)"
              className="sm:w-64"
            />
            <Button
              size="default"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await markReviewedAction(note);
                  if (res.ok) {
                    setNote("");
                    setDone(true);
                    router.refresh();
                  }
                })
              }
            >
              {pending ? "기록 중..." : "점검 완료로 기록"}
            </Button>
          </div>
        </div>
        {done && (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
            점검 기록을 남겼어요.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value || "all"}
            size="sm"
            variant={actionFilter === f.value ? "default" : "outline"}
            onClick={() => setParam("action", f.value)}
          >
            {f.label}
          </Button>
        ))}
        <span className="text-muted-foreground mx-1 text-xs">|</span>
        {[30, 90, 365].map((d) => (
          <Button
            key={d}
            size="sm"
            variant={days === d ? "default" : "outline"}
            onClick={() => setParam("days", String(d))}
          >
            {d === 365 ? "1년" : `${d}일`}
          </Button>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        최근 {days}일 · {rows.length}건
        {sensitiveCount > 0 && ` (개인정보 반출·계정 변경 ${sensitiveCount}건)`}
        {rows.length >= 500 && " — 500건까지만 보여요. 기간을 좁혀보세요."}
      </p>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">일시</TableHead>
              <TableHead className="whitespace-nowrap">한 일</TableHead>
              <TableHead className="whitespace-nowrap">대상</TableHead>
              <TableHead className="whitespace-nowrap">상세</TableHead>
              <TableHead className="whitespace-nowrap">접속자</TableHead>
              <TableHead className="whitespace-nowrap">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-10 text-center text-sm"
                >
                  이 기간에는 기록이 없어요.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                    {formatKst(r.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={SENSITIVE.has(r.action) ? "warning" : "default"}
                    >
                      {ACTION_LABEL[r.action] ?? r.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {r.targetName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDetail(r.detail)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {r.actorName}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                    {r.ip ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** 마지막 점검이 31일을 넘겼는가 — 월 1회 기준을 넘긴 것으로 본다. */
function isOverdue(lastReviewedAt: string | null): boolean {
  if (!lastReviewedAt) return true;
  return Date.now() - new Date(lastReviewedAt).getTime() > 31 * 86400_000;
}

function formatKst(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** detail은 액션마다 모양이 달라 그대로 펴서 보여준다. */
function formatDetail(detail: Record<string, unknown> | null): string {
  if (!detail) return "—";
  const parts: string[] = [];
  if (detail.from && detail.to) parts.push(`${detail.from}~${detail.to}`);
  if (detail.sheet) parts.push(String(detail.sheet));
  if (typeof detail.students === "number") parts.push(`학생 ${detail.students}명`);
  if (typeof detail.rows === "number") parts.push(`${detail.rows}행`);
  if (detail.note) parts.push(String(detail.note));
  if (detail.matchedStudentId) parts.push("자녀 연결");
  return parts.length > 0 ? parts.join(" · ") : "—";
}
