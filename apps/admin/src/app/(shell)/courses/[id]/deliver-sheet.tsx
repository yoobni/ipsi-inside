"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { DELIVERY_KIND_LABEL, type DeliveryKind } from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deliverSessionAction } from "../actions";
import type { DeliveryRow, GroupLite, SessionData, StudentLite } from "./course-detail-client";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });

function studentLine(s: StudentLite): string {
  return [s.school, s.grade ? `${s.grade}학년` : null].filter(Boolean).join(" · ");
}

/**
 * 수업 진행 처리(regular) — 반을 고르면 그 반 학생이 전부 체크된 채로 뜬다.
 * 오늘 결석 표시된 학생은 체크 해제, 이미 받은 학생은 '받음'으로 잠금.
 * 보강 배부(makeup) — 담당 범위 학생 아무나 골라 개별 배부.
 */
export function DeliverSheet({
  open,
  onOpenChange,
  mode,
  session,
  groups,
  usingFallbackGroups,
  students,
  members,
  delivered,
  absentIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: DeliveryKind;
  session: SessionData | null;
  groups: GroupLite[];
  usingFallbackGroups: boolean;
  students: StudentLite[];
  members: { group_id: string; student_id: string }[];
  delivered: Map<string, DeliveryRow>;
  absentIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const absent = useMemo(() => new Set(absentIds), [absentIds]);

  const membersOf = (groupId: string): StudentLite[] =>
    members
      .filter((m) => m.group_id === groupId)
      .flatMap((m) => {
        const s = studentById.get(m.student_id);
        return s ? [s] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  // 기본 체크 = 아직 안 받았고 오늘 결석 아닌 학생 전부
  const defaultChecked = (groupId: string) =>
    new Set(membersOf(groupId).filter((s) => !delivered.has(s.id) && !absent.has(s.id)).map((s) => s.id));

  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [checked, setChecked] = useState<Set<string>>(() => (mode === "regular" && groups[0] ? defaultChecked(groups[0].id) : new Set()));

  const pickGroup = (id: string) => {
    setGroupId(id);
    setChecked(defaultChecked(id));
    setResult(null);
  };
  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };

  const rows: StudentLite[] =
    mode === "regular"
      ? groupId
        ? membersOf(groupId)
        : []
      : (() => {
          const q = query.trim().toLowerCase();
          if (!q) return students;
          return students.filter((s) => s.name.toLowerCase().includes(q) || (s.school ?? "").toLowerCase().includes(q));
        })();
  const selectable = rows.filter((s) => !delivered.has(s.id));

  const submit = () => {
    if (!session || checked.size === 0) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await deliverSessionAction({ sessionId: session.id, studentIds: [...checked], kind: mode });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setResult(`${r.delivered}명에게 배부했어요${r.skipped > 0 ? ` (이미 받은 ${r.skipped}명 제외)` : ""}`);
      setChecked(new Set());
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        {session && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="truncate text-lg">
                {mode === "regular" ? "수업 진행 처리" : "보강 배부"} · {session.title}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {mode === "regular"
                  ? "오늘 수업을 들은 학생을 체크해 이 회차 묶음(자료·퀴즈·훈련·가이드·숙제)을 한 번에 배부해요. 학생·학부모에게 알림이 가요."
                  : "결석했거나 중간에 들어온 학생에게 이 회차를 따로 배부해요. 학생·학부모에게 알림이 가요."}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-3 overflow-y-auto px-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {result && (
                <Alert>
                  <AlertDescription>{result}</AlertDescription>
                </Alert>
              )}

              {mode === "regular" ? (
                groups.length === 0 ? (
                  <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">
                    볼 수 있는 반이 없어요. 보강 배부로 학생을 직접 골라주세요.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <label htmlFor="deliver-group" className="text-sm font-medium">반</label>
                    <select
                      id="deliver-group"
                      value={groupId}
                      onChange={(e) => pickGroup(e.target.value)}
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    >
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    {usingFallbackGroups && (
                      <p className="text-muted-foreground text-[11px]">이 코스에 연결된 반이 없어서 볼 수 있는 모든 반을 보여줘요.</p>
                    )}
                  </div>
                )
              ) : (
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름·학교 검색" className="pl-8" />
                </div>
              )}

              {(mode === "makeup" || groups.length > 0) && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">
                      선택 {checked.size}명{mode === "regular" && ` / 반 ${rows.length}명`}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={selectable.length === 0}
                        onClick={() => setChecked(new Set([...checked, ...selectable.map((s) => s.id)]))}
                      >
                        {mode === "regular" ? "전체 선택" : "보이는 학생 선택"}
                      </Button>
                      <Button size="sm" variant="outline" disabled={checked.size === 0} onClick={() => setChecked(new Set())}>
                        모두 해제
                      </Button>
                    </div>
                  </div>

                  {rows.length === 0 ? (
                    <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">
                      {mode === "regular" ? "이 반에 학생이 없어요." : "학생이 없어요."}
                    </p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {rows.map((s) => {
                        const got = delivered.get(s.id);
                        return (
                          <li key={s.id}>
                            <label className={`flex items-center gap-3 px-3 py-2 ${got ? "opacity-60" : "hover:bg-muted/50 cursor-pointer"}`}>
                              <input
                                type="checkbox"
                                className="size-4 accent-current"
                                disabled={!!got}
                                checked={!got && checked.has(s.id)}
                                onChange={() => toggle(s.id)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{s.name}</p>
                                {studentLine(s) && <p className="text-muted-foreground truncate text-xs">{studentLine(s)}</p>}
                              </div>
                              {got ? (
                                <Badge variant="success" className="shrink-0">
                                  받음 · {fmtDate(got.delivered_at)} {DELIVERY_KIND_LABEL[got.kind]}
                                </Badge>
                              ) : absent.has(s.id) ? (
                                <Badge variant="warning" className="shrink-0">오늘 결석</Badge>
                              ) : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>

            <SheetFooter className="flex-row justify-end border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                {result ? "닫기" : "취소"}
              </Button>
              <Button onClick={submit} disabled={pending || checked.size === 0}>
                {pending ? "배부 중…" : `${checked.size}명 배부`}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
