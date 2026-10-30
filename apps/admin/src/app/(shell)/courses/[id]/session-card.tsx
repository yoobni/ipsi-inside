"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Send, Trash2, UserPlus, X } from "lucide-react";
import { COURSE_ITEM_KIND, COURSE_ITEM_KIND_LABEL, type CourseItemInput, type CourseItemKind, type DeliveryKind } from "@ipsi/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deleteSessionAction, moveSessionAction, saveSessionAction, syncSessionAssignmentsAction } from "../actions";
import type { ItemRefs, SessionData } from "./course-detail-client";

const AUDIENCE_LABEL = { all: "전체", student: "학생 전체", parent: "학부모 전체", targeted: "지정 학생", group: "그룹" } as const;
const DUE_OPTIONS: (number | null)[] = [null, 0, 1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30];
const dueLabel = (d: number | null) => (d == null ? "마감 없음" : d === 0 ? "당일까지" : `${d}일 뒤까지`);

type Described = { title: string; warnings: string[]; missing: boolean };

/** 항목 → 화면 표시용 제목 + 경고(학생에게 안 보이거나 배부가 무의미한 경우) */
function describe(it: CourseItemInput, refs: ItemRefs): Described {
  switch (it.kind) {
    case "material": {
      const m = refs.materials.find((x) => x.id === it.materialId);
      if (!m) return { title: "볼 수 없거나 삭제된 자료", warnings: [], missing: true };
      const w: string[] = [];
      if (!m.published) w.push("미발행 — 미발행 자료는 학생에게 안 보여요");
      if (m.audience !== "targeted" && m.audience !== "group")
        w.push(`대상 '${AUDIENCE_LABEL[m.audience]}' — 배부와 상관없이 이미 공개돼 있어요`);
      return { title: m.title, warnings: w, missing: false };
    }
    case "test": {
      const t = refs.tests.find((x) => x.id === it.testSheetId);
      return t ? { title: t.title, warnings: [], missing: false } : { title: "볼 수 없거나 삭제된 시험지", warnings: [], missing: true };
    }
    case "drill": {
      const d = refs.drills.find((x) => x.id === it.drillId);
      if (!d) return { title: "볼 수 없거나 삭제된 훈련", warnings: [], missing: true };
      return { title: d.title, warnings: d.published ? [] : ["초안 — 발행 전엔 학생에게 안 보여요"], missing: false };
    }
    case "guide": {
      const g = refs.guides.find((x) => x.id === it.guideId);
      if (!g) return { title: "볼 수 없거나 삭제된 가이드", warnings: [], missing: true };
      return { title: g.title, warnings: g.published ? [] : ["초안 — 발행 전엔 학생에게 안 보여요"], missing: false };
    }
    case "homework":
      return { title: it.title, warnings: [], missing: false };
  }
}

function refId(it: CourseItemInput): string | null {
  switch (it.kind) {
    case "material": return it.materialId;
    case "test": return it.testSheetId;
    case "drill": return it.drillId;
    case "guide": return it.guideId;
    case "homework": return null;
  }
}

/** 피커 선택지 전체 — 부모가 첫 편집기 열림에 한 번 읽어 모든 카드에 내려준다 */
export type RefsCatalog = { refs: ItemRefs | null; error: string | null; retry: () => void };

export function SessionCard({
  index,
  total,
  session,
  refs,
  catalog,
  onOpenEditor,
  deliveredCount,
  onDeliver,
  onError,
}: {
  index: number;
  total: number;
  session: SessionData;
  refs: ItemRefs;
  catalog: RefsCatalog;
  /** 편집기를 열 때 — 부모가 피커 목록을 아직 안 읽었으면 읽는다 */
  onOpenEditor: () => void;
  deliveredCount: number;
  onDeliver: (mode: DeliveryKind) => void;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    onError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) onError(r.message ?? "오류가 발생했어요");
      else router.refresh();
    });
  };

  const warnCount = session.items.reduce((n, it) => n + (describe(it, refs).warnings.length > 0 ? 1 : 0), 0);

  return (
    <li className="rounded-md border bg-card">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => {
            if (!open) onOpenEditor();
            setOpen((o) => !o);
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{index + 1}</span>
          <div className="min-w-0">
            <p className="truncate font-medium">{session.title}</p>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
              <span>항목 {session.items.length}개</span>
              <span>· 배부 {deliveredCount}명</span>
              {warnCount > 0 && <span className="text-amber-600 dark:text-amber-400">· 확인 필요 {warnCount}</span>}
            </p>
          </div>
          {open ? <ChevronUp className="text-muted-foreground ml-auto size-4 shrink-0" /> : <ChevronDown className="text-muted-foreground ml-auto size-4 shrink-0" />}
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={() => onDeliver("regular")} disabled={session.items.length === 0}>
            <Send className="size-3.5" />
            수업 진행 처리
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDeliver("makeup")} disabled={session.items.length === 0}>
            <UserPlus className="size-3.5" />
            보강 배부
          </Button>
          <Button size="icon" variant="ghost" className="size-8" aria-label="위로" disabled={pending || index === 0} onClick={() => run(() => moveSessionAction(session.id, "up"))}>
            <ArrowUp className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" aria-label="아래로" disabled={pending || index === total - 1} onClick={() => run(() => moveSessionAction(session.id, "down"))}>
            <ArrowDown className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" aria-label="회차 삭제" disabled={pending} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="text-destructive size-3.5" />
          </Button>
        </div>
      </div>

      {confirmDelete && (
        <div className="bg-destructive/5 flex flex-wrap items-center gap-2 border-t px-4 py-2">
          <span className="text-destructive flex-1 text-xs">
            &lsquo;{session.title}&rsquo; 회차를 삭제할까요?
            {deliveredCount > 0 && ` 배부 기록 ${deliveredCount}명분과 숙제 체크도 함께 지워져요(이미 들어간 자료·시험 배정은 남아요).`}
          </span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirmDelete(false)}>
            취소
          </Button>
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => deleteSessionAction(session.id))}>
            삭제
          </Button>
        </div>
      )}

      {session.items.length > 0 && !open && (
        <div className="flex flex-wrap gap-1 border-t px-4 py-2">
          {session.items.map((it, i) => {
            const d = describe(it, refs);
            return (
              <Badge key={i} variant={d.warnings.length > 0 || d.missing ? "warning" : "default"} className="max-w-full">
                <span className="text-muted-foreground shrink-0">{COURSE_ITEM_KIND_LABEL[it.kind]}</span>
                <span className="truncate">{d.title}</span>
              </Badge>
            );
          })}
        </div>
      )}

      {open && (
        <SessionEditor
          session={session}
          refs={refs}
          catalog={catalog}
          deliveredCount={deliveredCount}
          onSaved={() => router.refresh()}
          onError={onError}
        />
      )}
    </li>
  );
}

type Row = { key: string; input: CourseItemInput };
const nextKey = () => crypto.randomUUID();

function SessionEditor({
  session,
  refs: pageRefs,
  catalog,
  deliveredCount,
  onSaved,
  onError,
}: {
  session: SessionData;
  refs: ItemRefs;
  catalog: RefsCatalog;
  deliveredCount: number;
  onSaved: () => void;
  onError: (msg: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(session.title);
  const [summary, setSummary] = useState(session.summary ?? "");
  const [rows, setRows] = useState<Row[]>(() => session.items.map((input) => ({ key: nextKey(), input })));
  const [addKind, setAddKind] = useState<CourseItemKind>("material");
  const [saved, setSaved] = useState(false);
  // 저장은 됐는데 배정 동기화만 실패 — 저장 버튼은 비활성(dirty 아님)이라 따로 재시도 버튼을 둔다
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const retrySync = () => {
    onError(null);
    startTransition(async () => {
      const r = await syncSessionAssignmentsAction(session.id);
      if (!r.ok) onError(r.message);
      else setSyncWarning(null);
    });
  };
  // 저장 직후의 항목(행 id 포함). 다음 저장이 id로 맞추게 하고, dirty 비교 기준도 이걸로 바꾼다
  const [baseline, setBaseline] = useState<{ title: string; summary: string; items: CourseItemInput[] }>({
    title: session.title,
    summary: session.summary ?? "",
    items: session.items,
  });

  const allRefs = catalog.refs;
  // 표시용: 페이지가 준 "이 코스가 쓰는 참조" + 피커 전체(읽힌 뒤)
  const refs = useMemo<ItemRefs>(() => {
    if (!allRefs) return pageRefs;
    const merge = <T extends { id: string }>(a: T[], b: T[]) => {
      const m = new Map<string, T>();
      [...a, ...b].forEach((x) => m.set(x.id, x));
      return [...m.values()];
    };
    return {
      materials: merge(pageRefs.materials, allRefs.materials),
      tests: merge(pageRefs.tests, allRefs.tests),
      drills: merge(pageRefs.drills, allRefs.drills),
      guides: merge(pageRefs.guides, allRefs.guides),
    };
  }, [pageRefs, allRefs]);

  const dirty =
    title !== baseline.title ||
    summary !== baseline.summary ||
    JSON.stringify(rows.map((r) => r.input)) !== JSON.stringify(baseline.items);

  const update = (next: Row[]) => {
    setRows(next);
    setSaved(false);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  const save = () => {
    onError(null);
    startTransition(async () => {
      const r = await saveSessionAction(session.id, {
        title,
        summary: summary.trim() || null,
        items: rows.map((r) => r.input),
      });
      if (!r.ok) {
        onError(r.message);
        return;
      }
      // 서버가 돌려준 행 id를 입혀 둔다 — 다음 저장에서 숙제 문구를 고쳐도 같은 행이 갱신된다
      setRows(r.items.map((input) => ({ key: nextKey(), input })));
      setBaseline({ title, summary, items: r.items });
      setSaved(true);
      setSyncWarning(r.warning ?? null);
      onSaved();
    });
  };

  const taken = useMemo(() => new Set(rows.map((r) => `${r.input.kind}:${refId(r.input)}`)), [rows]);

  return (
    <div className="space-y-4 border-t px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`st-${session.id}`}>회차 이름</Label>
          <Input id={`st-${session.id}`} value={title} maxLength={60} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`ss-${session.id}`}>수업 요약 (선택)</Label>
          <Textarea id={`ss-${session.id}`} value={summary} maxLength={500} rows={1} onChange={(e) => { setSummary(e.target.value); setSaved(false); }} />
        </div>
      </div>

      {/* 담긴 항목 */}
      <div className="space-y-2">
        <Label>이 회차에 담긴 것 ({rows.length})</Label>
        {rows.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">아래에서 복습지·퀴즈·훈련·가이드·숙제를 담아주세요.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((r, i) => {
              const d = describe(r.input, refs);
              return (
                <li key={r.key} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant="outline" className="shrink-0">{COURSE_ITEM_KIND_LABEL[r.input.kind]}</Badge>
                      {r.input.kind === "homework" ? (
                        <Input
                          value={r.input.title}
                          maxLength={200}
                          className="h-8"
                          aria-label="숙제 내용"
                          onChange={(e) =>
                            update(rows.map((x, j) => (j === i && x.input.kind === "homework" ? { ...x, input: { ...x.input, title: e.target.value } } : x)))
                          }
                        />
                      ) : (
                        <span className={cn("truncate text-sm", d.missing && "text-muted-foreground italic")}>{d.title}</span>
                      )}
                    </div>
                    {d.warnings.map((w) => (
                      <p key={w} className="text-xs text-amber-600 dark:text-amber-400">⚠ {w}</p>
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {r.input.kind === "homework" && (
                      <select
                        value={r.input.dueDays ?? ""}
                        aria-label="마감"
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          update(rows.map((x, j) => (j === i && x.input.kind === "homework" ? { ...x, input: { ...x.input, dueDays: v } } : x)));
                        }}
                      >
                        {DUE_OPTIONS.map((o) => (
                          <option key={String(o)} value={o ?? ""}>{dueLabel(o)}</option>
                        ))}
                      </select>
                    )}
                    <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="위로" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="아래로" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="빼기" onClick={() => update(rows.filter((_, j) => j !== i))}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 항목 추가 */}
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <div className="flex flex-wrap gap-1">
          {COURSE_ITEM_KIND.map((k) => (
            <Button key={k} type="button" size="sm" variant={addKind === k ? "default" : "outline"} onClick={() => setAddKind(k)}>
              {COURSE_ITEM_KIND_LABEL[k]}
            </Button>
          ))}
        </div>
        {addKind === "homework" ? (
          <HomeworkAdder onAdd={(input) => update([...rows, { key: nextKey(), input }])} />
        ) : catalog.error ? (
          <p className="text-destructive flex items-center justify-center gap-2 py-4 text-xs">
            {catalog.error}
            <Button type="button" size="sm" variant="outline" onClick={catalog.retry}>다시 시도</Button>
          </p>
        ) : !allRefs ? (
          <p className="text-muted-foreground py-4 text-center text-xs">목록을 불러오는 중…</p>
        ) : (
          <RefPicker kind={addKind} refs={allRefs} taken={taken} onAdd={(input) => update([...rows, { key: nextKey(), input }])} />
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          {deliveredCount > 0
            ? `이미 ${deliveredCount}명이 이 회차를 받았어요. 저장하면 새로 담은 자료·퀴즈도 그 학생들에게 바로 들어가요(알림은 안 가요).`
            : "배부 전이라 자유롭게 고쳐도 돼요."}
        </p>
        <div className="flex flex-wrap items-center gap-2 self-end">
          {syncWarning && (
            <>
              <span className="text-xs text-amber-600 dark:text-amber-400">{syncWarning}</span>
              <Button size="sm" variant="outline" disabled={pending} onClick={retrySync}>
                배정 다시 채우기
              </Button>
            </>
          )}
          {saved && !dirty && !syncWarning && <span className="text-xs text-emerald-600">저장됨</span>}
          <Button size="sm" onClick={save} disabled={pending || !dirty || !title.trim()}>
            {pending ? "저장 중…" : "회차 저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function HomeworkAdder({ onAdd }: { onAdd: (input: CourseItemInput) => void }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState<number | null>(null);
  const add = () => {
    const t = text.trim();
    if (!t) return;
    onAdd({ kind: "homework", title: t, dueDays: due });
    setText("");
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={text}
        maxLength={200}
        placeholder="예) 독서 지문 3개 풀고 오답 정리"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) add();
        }}
      />
      <div className="flex gap-2">
        <select
          value={due ?? ""}
          aria-label="마감"
          className="h-9 flex-1 rounded-md border bg-background px-2 text-sm sm:flex-none"
          onChange={(e) => setDue(e.target.value === "" ? null : Number(e.target.value))}
        >
          {DUE_OPTIONS.map((o) => (
            <option key={String(o)} value={o ?? ""}>{dueLabel(o)}</option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={add} disabled={!text.trim()}>
          <Plus className="size-4" />
          담기
        </Button>
      </div>
    </div>
  );
}

type PickOption = { id: string; title: string; badges: { label: string; warn: boolean }[] };

function RefPicker({
  kind,
  refs,
  taken,
  onAdd,
}: {
  kind: Exclude<CourseItemKind, "homework">;
  refs: ItemRefs;
  taken: Set<string>;
  onAdd: (input: CourseItemInput) => void;
}) {
  const [q, setQ] = useState("");
  const options: PickOption[] =
    kind === "material"
      ? refs.materials.map((m) => ({
          id: m.id,
          title: m.title,
          badges: [
            { label: m.published ? "발행" : "미발행", warn: !m.published },
            { label: AUDIENCE_LABEL[m.audience], warn: m.audience !== "targeted" && m.audience !== "group" },
          ],
        }))
      : kind === "test"
        ? refs.tests.map((t) => ({ id: t.id, title: t.title, badges: [] }))
        : (kind === "drill" ? refs.drills : refs.guides).map((x) => ({
            id: x.id,
            title: x.title,
            badges: [{ label: x.published ? "발행" : "초안", warn: !x.published }],
          }));
  const term = q.trim().toLowerCase();
  const shown = term ? options.filter((o) => o.title.toLowerCase().includes(term)) : options;

  const make = (id: string): CourseItemInput =>
    kind === "material"
      ? { kind, materialId: id }
      : kind === "test"
        ? { kind, testSheetId: id }
        : kind === "drill"
          ? { kind, drillId: id }
          : { kind, guideId: id };

  return (
    <div className="space-y-2">
      <Input value={q} placeholder={`${COURSE_ITEM_KIND_LABEL[kind]} 검색`} onChange={(e) => setQ(e.target.value)} />
      {kind === "material" && (
        <p className="text-muted-foreground text-[11px]">
          미발행 자료는 학생에게 안 보여요. 배부로 여는 자료는 대상이 &lsquo;지정 학생&rsquo;이나 &lsquo;그룹&rsquo;이어야 의미가 있어요.
        </p>
      )}
      {shown.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-xs">{options.length === 0 ? "볼 수 있는 항목이 없어요." : "검색 결과가 없어요."}</p>
      ) : (
        <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
          {shown.map((o) => {
            const isTaken = taken.has(`${kind}:${o.id}`);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={isTaken}
                  onClick={() => onAdd(make(o.id))}
                  className="hover:bg-muted/50 flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm disabled:cursor-default disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate">{o.title}</span>
                  {o.badges.map((b) => (
                    <Badge key={b.label} variant={b.warn ? "warning" : "outline"}>{b.label}</Badge>
                  ))}
                  {isTaken ? <Badge variant="default">담김</Badge> : <Plus className="text-muted-foreground size-3.5" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
