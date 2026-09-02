"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  PASSAGE_SOURCE,
  PASSAGE_SOURCE_LABEL,
  type PassageSource,
  type QuestionChoice,
  type TestSheetInput,
} from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { createTestSheetAction, updateTestSheetAction } from "./actions";

export type AvailableQuestion = {
  id: string;
  passage: {
    id: string;
    title: string;
    source_type: PassageSource;
    unit_major: string;
    unit_minor: string | null;
  };
  position_in_passage: number;
  stem: string;
  supplementary: string | null;
  choices: QuestionChoice[];
  correct_answer: number;
  points: number;
  difficulty: "상" | "중" | "하" | null;
  unit_minor: string | null;
};

type Props =
  | {
      mode: "create";
      available: AvailableQuestion[];
    }
  | {
      mode: "edit";
      testSheetId: string;
      defaultMeta: TestSheetInput;
      defaultQuestionIds: string[];
      available: AvailableQuestion[];
    };

export function TestComposer(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultMeta: TestSheetInput =
    props.mode === "edit"
      ? props.defaultMeta
      : {
          title: "",
          description: null,
          target_school: null,
          target_grade: null,
          open_at: null,
          due_at: null,
          allow_retake: false,
          max_attempts: 1,
        };

  const [meta, setMeta] = useState<TestSheetInput>(defaultMeta);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    props.mode === "edit" ? props.defaultQuestionIds : [],
  );
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<PassageSource | "all">("all");

  const updateMeta = <K extends keyof TestSheetInput>(
    key: K,
    value: TestSheetInput[K],
  ) => {
    setMeta((p) => ({ ...p, [key]: value }));
  };

  const filtered = useMemo(() => {
    const q = query.trim();
    return props.available.filter((aq) => {
      if (sourceFilter !== "all" && aq.passage.source_type !== sourceFilter)
        return false;
      if (!q) return true;
      const hay = `${aq.passage.title} ${aq.passage.unit_major} ${aq.stem}`;
      return hay.includes(q);
    });
  }, [props.available, query, sourceFilter]);

  // 사용 가능 문항을 지문별로 그룹화
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { passage: AvailableQuestion["passage"]; questions: AvailableQuestion[] }
    >();
    filtered.forEach((q) => {
      if (!map.has(q.passage.id)) {
        map.set(q.passage.id, { passage: q.passage, questions: [] });
      }
      map.get(q.passage.id)!.questions.push(q);
    });
    return Array.from(map.values());
  }, [filtered]);

  const byId = useMemo(() => {
    const m = new Map<string, AvailableQuestion>();
    props.available.forEach((aq) => m.set(aq.id, aq));
    return m;
  }, [props.available]);

  const addQuestion = (id: string) => {
    if (selectedIds.includes(id)) return;
    setSelectedIds((p) => [...p, id]);
  };
  const removeQuestion = (id: string) => {
    setSelectedIds((p) => p.filter((x) => x !== id));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= selectedIds.length) return;
    setSelectedIds((p) => {
      const a = [...p];
      [a[idx], a[next]] = [a[next]!, a[idx]!];
      return a;
    });
  };
  const addPassageAll = (passageId: string) => {
    const qs = props.available
      .filter((aq) => aq.passage.id === passageId)
      .filter((aq) => !selectedIds.includes(aq.id))
      .map((aq) => aq.id);
    if (qs.length === 0) return;
    setSelectedIds((p) => [...p, ...qs]);
  };

  const totalPoints = selectedIds.reduce(
    (sum, id) => sum + (byId.get(id)?.points ?? 0),
    0,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!meta.title.trim()) return setError("시험지 제목을 입력해주세요");
    if (selectedIds.length === 0)
      return setError("문항을 최소 1개 추가해주세요");

    // 정규화: allow_retake=false면 max_attempts=1
    const normalizedMeta: TestSheetInput = {
      ...meta,
      max_attempts: meta.allow_retake ? meta.max_attempts ?? null : 1,
    };

    const payload = {
      meta: normalizedMeta,
      question_ids: selectedIds,
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));

    startTransition(async () => {
      const r =
        props.mode === "edit"
          ? await updateTestSheetAction(props.testSheetId, null, fd)
          : await createTestSheetAction(null, fd);
      if (r.ok) {
        router.push(props.mode === "edit" ? `/tests/${props.testSheetId}` : "/tests");
      } else {
        setError(r.message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 메타 정보 */}
      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">시험지 정보 / 일정</h2>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">제목 *</Label>
            <Input
              id="title"
              value={meta.title}
              onChange={(e) => updateMeta("title", e.target.value)}
              placeholder="예) 2026년 6월 모의고사"
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="desc">설명 (선택)</Label>
            <Textarea
              id="desc"
              value={meta.description ?? ""}
              onChange={(e) => updateMeta("description", e.target.value || null)}
              placeholder="학생에게 노출할 시험 설명 (선택)"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school">대상 학교 (선택)</Label>
            <Input
              id="school"
              value={meta.target_school ?? ""}
              onChange={(e) =>
                updateMeta("target_school", e.target.value || null)
              }
              placeholder="OO고등학교"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grade">대상 학년</Label>
            <Select
              value={meta.target_grade ? String(meta.target_grade) : "_none"}
              onValueChange={(v) =>
                updateMeta("target_grade", v === "_none" ? null : Number(v))
              }
            >
              <SelectTrigger id="grade" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">-</SelectItem>
                <SelectItem value="1">1학년</SelectItem>
                <SelectItem value="2">2학년</SelectItem>
                <SelectItem value="3">3학년</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="open">오픈 일시 (선택)</Label>
            <Input
              id="open"
              type="datetime-local"
              value={isoToLocal(meta.open_at)}
              onChange={(e) =>
                updateMeta("open_at", localToIso(e.target.value))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due">마감 일시 (선택)</Label>
            <Input
              id="due"
              type="datetime-local"
              value={isoToLocal(meta.due_at)}
              onChange={(e) =>
                updateMeta("due_at", localToIso(e.target.value))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>재응시 정책</Label>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={meta.allow_retake}
                  onChange={(e) => updateMeta("allow_retake", e.target.checked)}
                  className="size-4 accent-current"
                />
                재응시 허용
              </label>
              {meta.allow_retake && (
                <>
                  <span className="text-muted-foreground text-xs">최대</span>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={meta.max_attempts ?? ""}
                    onChange={(e) =>
                      updateMeta(
                        "max_attempts",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    placeholder="무제한"
                    className="w-20"
                  />
                  <span className="text-muted-foreground text-xs">회</span>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>합계</Label>
            <p className="text-sm">
              <strong>{selectedIds.length}</strong>문항 ·{" "}
              <strong>{totalPoints}</strong>점
            </p>
          </div>
        </div>
      </section>

      {/* 좌(picker) / 우(시험지) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 좌: 사용 가능 문항 */}
        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">등록된 지문/문항</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              [+] 눌러 시험지에 추가
            </p>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="지문 제목/문제 본문 검색"
                  className="pl-9"
                />
              </div>
              <Tabs
                value={sourceFilter}
                onValueChange={(v) =>
                  setSourceFilter(v as PassageSource | "all")
                }
              >
                <TabsList>
                  <TabsTrigger value="all">전체</TabsTrigger>
                  {PASSAGE_SOURCE.map((s) => (
                    <TabsTrigger key={s} value={s}>
                      {PASSAGE_SOURCE_LABEL[s].replace(/\(.+?\)/, "")}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {grouped.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
                {props.available.length === 0
                  ? "등록된 지문/문항이 없어요. 먼저 [지문/문항] 메뉴에서 등록하세요."
                  : "검색 결과가 없어요."}
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {grouped.map((g) => (
                  <li key={g.passage.id} className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {g.passage.title}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          <Badge variant="primary" className="mr-1">
                            {PASSAGE_SOURCE_LABEL[g.passage.source_type]}
                          </Badge>
                          {g.passage.unit_major}
                          {g.passage.unit_minor ? ` · ${g.passage.unit_minor}` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addPassageAll(g.passage.id)}
                      >
                        <Plus className="size-3" />
                        전체 추가
                      </Button>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {g.questions.map((q) => {
                        const selected = selectedIds.includes(q.id);
                        return (
                          <li
                            key={q.id}
                            className={cn(
                              "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                              selected
                                ? "border-primary/30 bg-primary/5"
                                : "border-input hover:bg-muted/50",
                            )}
                          >
                            <span className="bg-muted text-muted-foreground inline-flex size-6 shrink-0 items-center justify-center rounded text-xs font-bold tabular-nums">
                              {q.position_in_passage}
                            </span>
                            <p
                              className="min-w-0 flex-1 truncate text-xs"
                              dangerouslySetInnerHTML={{
                                __html: stripHtml(q.stem).slice(0, 80),
                              }}
                            />
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {q.points}점
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={selected}
                              onClick={() => addQuestion(q.id)}
                              className="size-7"
                              aria-label="추가"
                            >
                              <Plus className="size-3.5" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 우: 시험지에 추가된 문항 */}
        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">
              시험지 ({selectedIds.length}문항)
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              ▲▼ 순서 조정, 휴지통으로 제거. 시험지 번호는 위에서부터 1, 2, 3...
            </p>
          </div>
          <div className="p-4">
            {selectedIds.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-8 text-center text-sm">
                좌측에서 문항을 추가하세요.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {selectedIds.map((id, idx) => {
                  const q = byId.get(id);
                  if (!q) {
                    return (
                      <li key={id} className="text-muted-foreground text-xs">
                        (missing question {id})
                      </li>
                    );
                  }
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-2"
                    >
                      <span className="bg-primary/10 text-primary inline-flex size-7 shrink-0 items-center justify-center rounded text-xs font-bold tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {q.passage.title}
                          <span className="text-muted-foreground ml-1.5">
                            #{q.position_in_passage}
                          </span>
                        </p>
                        <p
                          className="text-muted-foreground truncate text-xs"
                          dangerouslySetInnerHTML={{
                            __html: stripHtml(q.stem).slice(0, 80),
                          }}
                        />
                      </div>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {q.points}점
                      </span>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                          className="size-7"
                          aria-label="위로"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => move(idx, 1)}
                          disabled={idx === selectedIds.length - 1}
                          className="size-7"
                          aria-label="아래로"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeQuestion(id)}
                          className="size-7"
                          aria-label="제거"
                        >
                          <X className="text-destructive size-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      </div>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <a href={props.mode === "edit" ? `/tests/${props.testSheetId}` : "/tests"}>
            취소
          </a>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? "저장 중..."
            : props.mode === "edit"
              ? "변경 저장"
              : "시험지 생성"}
        </Button>
      </div>
    </form>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  // ISO → datetime-local 입력 포맷 (YYYY-MM-DDTHH:MM)
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}
