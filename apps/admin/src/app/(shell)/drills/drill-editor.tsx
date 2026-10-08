"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import {
  DRILL_KIND,
  DRILL_KIND_HINT,
  DRILL_KIND_LABEL,
  PASSAGE_SOURCE,
  PASSAGE_SOURCE_LABEL,
  type DrillItemInput,
  type DrillKind,
  type PassageSource,
  type TaxonomyLists,
} from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveDrillAction } from "./actions";

const NONE = "__none__";

export type EditorItem = { id: string | null; item: DrillItemInput };
export type DrillEditorInitial = {
  title: string;
  description: string;
  kind: DrillKind;
  area: PassageSource | null;
  workId: string | null;
  conceptIds: string[];
  timeLimitSec: number | null;
  items: EditorItem[];
};

function emptyItem(kind: DrillKind): DrillItemInput {
  if (kind === "ox") return { kind, prompt: "", answer: { value: true }, explanation: null };
  if (kind === "choice") return { kind, prompt: "", options: ["", ""], answer: { index: 0 }, explanation: null };
  return { kind, prompt: "", buckets: ["", ""], tokens: ["", ""], answer: { assignments: [0, 0] }, explanation: null };
}

export function DrillEditor({
  drillId,
  initial,
  taxonomy,
}: {
  drillId?: string;
  initial?: DrillEditorInitial;
  taxonomy: TaxonomyLists;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kind, setKind] = useState<DrillKind>(initial?.kind ?? "ox");
  const [area, setArea] = useState<PassageSource | null>(initial?.area ?? null);
  const [workId, setWorkId] = useState<string | null>(initial?.workId ?? null);
  const [conceptIds, setConceptIds] = useState<string[]>(initial?.conceptIds ?? []);
  const [timeLimit, setTimeLimit] = useState<string>(initial?.timeLimitSec?.toString() ?? "");
  const [items, setItems] = useState<EditorItem[]>(initial?.items ?? [{ id: null, item: emptyItem("ox") }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changeKind = (k: DrillKind) => {
    if (k === kind) return;
    if (items.some((x) => x.id) && !confirm("종류를 바꾸면 기존 항목과 학생 풀이 기록이 모두 지워져요. 계속할까요?")) return;
    setKind(k);
    setItems([{ id: null, item: emptyItem(k) }]);
  };
  const updateItem = (idx: number, item: DrillItemInput) =>
    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, item } : x)));

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await saveDrillAction(drillId ?? null, {
        title,
        description: description || null,
        kind,
        area,
        workId,
        conceptIds,
        timeLimitSec: timeLimit ? Number(timeLimit) : null,
        items,
      });
      if (!r.ok) return setError(r.message);
      router.push("/drills");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/drills">
          <ChevronLeft className="size-4" />
          목록
        </Link>
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">훈련 정보</h2></div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="d-title">제목 *</Label>
            <Input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="예: 품사 분류 — 명사/대명사/수사" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="d-desc">설명 (선택)</Label>
            <Input id="d-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="학생에게 보이는 한 줄" />
          </div>
          <div className="space-y-2">
            <Label>종류 *</Label>
            <div className="flex flex-wrap gap-2">
              {DRILL_KIND.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => changeKind(k)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${kind === k ? "border-primary bg-primary/10 text-primary font-bold" : "border-input"}`}
                  title={DRILL_KIND_HINT[k]}
                >
                  {DRILL_KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{DRILL_KIND_HINT[kind]}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-time">문항당 제한 시간 (초, 선택)</Label>
            <Input id="d-time" type="number" min={3} max={300} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder="없음" />
          </div>
          <div className="space-y-2">
            <Label>영역</Label>
            <Select value={area ?? NONE} onValueChange={(v) => setArea(v === NONE ? null : (v as PassageSource))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>공통</SelectItem>
                {PASSAGE_SOURCE.map((s) => <SelectItem key={s} value={s}>{PASSAGE_SOURCE_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>작품 / 제재</Label>
            <Select value={workId ?? NONE} onValueChange={(v) => setWorkId(v === NONE ? null : v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>미지정</SelectItem>
                {taxonomy.works.map((w) => <SelectItem key={w.id} value={w.id}>{w.title}{w.author ? ` · ${w.author}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {taxonomy.concepts.length > 0 && (
            <div className="space-y-2 md:col-span-2">
              <Label>개념 (여러 개)</Label>
              <div className="flex flex-wrap gap-1.5">
                {taxonomy.concepts.filter((c) => !area || !c.area || c.area === area).map((c) => {
                  const on = conceptIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setConceptIds(on ? conceptIds.filter((x) => x !== c.id) : [...conceptIds, c.id])}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-primary bg-primary/10 text-primary font-bold" : "border-input text-muted-foreground"}`}
                    >
                      {c.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">항목 ({items.length})</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => setItems([...items, { id: null, item: emptyItem(kind) }])}>
            <Plus className="size-4" /> 항목 추가
          </Button>
        </div>
        <div className="space-y-4 p-4">
          {items.map((x, idx) => (
            <ItemEditor
              key={x.id ?? `new-${idx}`}
              index={idx}
              item={x.item}
              canRemove={items.length > 1}
              onChange={(it) => updateItem(idx, it)}
              onRemove={() => setItems(items.filter((_, i) => i !== idx))}
            />
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" size="lg"><Link href="/drills">취소</Link></Button>
        <Button size="lg" onClick={save} disabled={pending}>{pending ? "저장 중..." : drillId ? "저장" : "만들기"}</Button>
      </div>
    </div>
  );
}

function ItemEditor({
  index,
  item,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  item: DrillItemInput;
  canRemove: boolean;
  onChange: (it: DrillItemInput) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="bg-primary/10 text-primary inline-flex size-7 items-center justify-center rounded-md text-xs font-bold">{index + 1}</span>
        <span className="text-sm font-semibold">{DRILL_KIND_LABEL[item.kind]}</span>
        <Button type="button" size="icon" variant="ghost" className="ml-auto size-8" disabled={!canRemove} onClick={onRemove} aria-label="항목 삭제">
          <Trash2 className="text-destructive size-4" />
        </Button>
      </div>
      <div className="space-y-3 p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{item.kind === "ox" ? "진술 *" : item.kind === "choice" ? "문제 *" : "지시문 *"}</Label>
          <Textarea rows={2} value={item.prompt} onChange={(e) => onChange({ ...item, prompt: e.target.value })} maxLength={500}
            placeholder={item.kind === "ox" ? "예: '초점화'는 서술자가 사건을 바라보는 시각의 위치를 뜻한다." : item.kind === "choice" ? "예: 다음 중 품사가 다른 하나는?" : "예: 다음 단어를 품사별로 분류하세요."} />
        </div>

        {item.kind === "ox" && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">정답</span>
            {[true, false].map((v) => (
              <button key={String(v)} type="button" onClick={() => onChange({ ...item, answer: { value: v } })}
                className={`size-9 rounded-md border text-base font-bold ${item.answer.value === v ? "border-primary bg-primary/10 text-primary" : "border-input"}`}>
                {v ? "O" : "X"}
              </button>
            ))}
          </div>
        )}

        {item.kind === "choice" && (
          <div className="space-y-1.5">
            <Label className="text-xs">보기 (정답을 눌러 표시)</Label>
            {item.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <button type="button" onClick={() => onChange({ ...item, answer: { index: i } })}
                  className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${item.answer.index === i ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"}`}>
                  {["①", "②", "③", "④", "⑤"][i]}
                </button>
                <Input value={opt} onChange={(e) => onChange({ ...item, options: item.options.map((o, j) => (j === i ? e.target.value : o)) })} maxLength={200} />
                {item.options.length > 2 && (
                  <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="보기 삭제"
                    onClick={() => onChange({ ...item, options: item.options.filter((_, j) => j !== i), answer: { index: Math.min(item.answer.index, item.options.length - 2) } })}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {item.options.length < 5 && (
              <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...item, options: [...item.options, ""] })}><Plus className="size-3.5" />보기 추가</Button>
            )}
          </div>
        )}

        {item.kind === "classify" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">바구니 (2~4)</Label>
              {item.buckets.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-5 text-xs">{i + 1}</span>
                  <Input value={b} maxLength={40} onChange={(e) => onChange({ ...item, buckets: item.buckets.map((x, j) => (j === i ? e.target.value : x)) })} />
                  {item.buckets.length > 2 && (
                    <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="바구니 삭제"
                      onClick={() => onChange({ ...item, buckets: item.buckets.filter((_, j) => j !== i), answer: { assignments: item.answer.assignments.map((a) => (a >= item.buckets.length - 1 ? 0 : a)) } })}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {item.buckets.length < 4 && (
                <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...item, buckets: [...item.buckets, ""] })}><Plus className="size-3.5" />바구니 추가</Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">토큰 (2~12) — 각각 정답 바구니 선택</Label>
              {item.tokens.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={t} maxLength={60} className="flex-1" onChange={(e) => onChange({ ...item, tokens: item.tokens.map((x, j) => (j === i ? e.target.value : x)) })} />
                  <select
                    value={item.answer.assignments[i] ?? 0}
                    onChange={(e) => onChange({ ...item, answer: { assignments: item.answer.assignments.map((a, j) => (j === i ? Number(e.target.value) : a)) } })}
                    className="h-9 rounded-md border bg-background px-2 text-xs"
                    aria-label="정답 바구니"
                  >
                    {item.buckets.map((b, j) => <option key={j} value={j}>{j + 1}. {b || "(이름 없음)"}</option>)}
                  </select>
                  {item.tokens.length > 2 && (
                    <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="토큰 삭제"
                      onClick={() => onChange({ ...item, tokens: item.tokens.filter((_, j) => j !== i), answer: { assignments: item.answer.assignments.filter((_, j) => j !== i) } })}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {item.tokens.length < 12 && (
                <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...item, tokens: [...item.tokens, ""], answer: { assignments: [...item.answer.assignments, 0] } })}><Plus className="size-3.5" />토큰 추가</Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">해설 (선택) — 정오 판정 직후 보여요</Label>
          <Textarea rows={2} value={item.explanation ?? ""} maxLength={1000} onChange={(e) => onChange({ ...item, explanation: e.target.value || null })} />
        </div>
      </div>
    </div>
  );
}
