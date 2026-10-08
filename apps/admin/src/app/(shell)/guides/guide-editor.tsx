"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ImagePlus, Plus, Trash2 } from "lucide-react";
import {
  GUIDE_STEP_KIND,
  GUIDE_STEP_KIND_HINT,
  GUIDE_STEP_KIND_LABEL,
  type GuideStepKind,
  type GuideStepPayload,
} from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichEditor } from "@/components/rich-editor";
import { saveGuideAction, uploadGuideImageAction } from "./actions";

const NONE = "__none__";

export type EditorStep = { id: string | null; title: string; payload: GuideStepPayload };
export type GuideEditorRefs = {
  works: { id: string; title: string; author: string | null }[];
  passages: { id: string; title: string; work_id: string | null; source_type: string }[];
  drills: { id: string; title: string; kind: string; work_id: string | null; is_published: boolean }[];
};
export type GuideEditorInitial = { title: string; summary: string; workId: string | null; steps: EditorStep[] };

function emptyPayload(kind: GuideStepKind): GuideStepPayload {
  switch (kind) {
    case "intro": case "summary": case "review": return { kind, html: "" };
    case "read": return { kind, passage_id: "", note: null } as GuideStepPayload;
    case "visual": case "comic": return { kind, images: [], html: null };
    case "ox": return { kind, drill_id: "" } as GuideStepPayload;
    case "questions": return { kind, size: 10, note: null };
  }
}

const DEFAULT_STEPS: EditorStep[] = [
  { id: null, title: "이 작품, 왜 중요할까", payload: emptyPayload("intro") },
  { id: null, title: "지문 읽기", payload: emptyPayload("read") },
  { id: null, title: "OX로 점검", payload: emptyPayload("ox") },
  { id: null, title: "문제 풀기", payload: emptyPayload("questions") },
  { id: null, title: "핵심 정리", payload: emptyPayload("summary") },
];

export function GuideEditor({ guideId, initial, refs }: { guideId?: string; initial?: GuideEditorInitial; refs: GuideEditorRefs }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [workId, setWorkId] = useState<string | null>(initial?.workId ?? null);
  const [steps, setSteps] = useState<EditorStep[]>(initial?.steps ?? DEFAULT_STEPS);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (i: number, patch: Partial<EditorStep>) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await saveGuideAction(guideId ?? null, { title, summary: summary || null, workId, steps });
      if (!r.ok) return setError(r.message);
      router.push("/guides");
      router.refresh();
    });
  };

  // 작품을 고르면 지문·훈련 후보를 그 작품 것부터
  const passages = [...refs.passages].sort((a, b) => Number(b.work_id === workId) - Number(a.work_id === workId));
  const drills = [...refs.drills].sort((a, b) => Number(b.work_id === workId) - Number(a.work_id === workId));

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm"><Link href="/guides"><ChevronLeft className="size-4" />목록</Link></Button>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">가이드 정보</h2></div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="g-title">제목 *</Label>
            <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="예: 「춘향전」 처음부터 끝까지" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="g-summary">한 줄 소개</Label>
            <Input id="g-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} />
          </div>
          <div className="space-y-2">
            <Label>작품 / 제재</Label>
            <Select value={workId ?? NONE} onValueChange={(v) => setWorkId(v === NONE ? null : v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>미지정</SelectItem>
                {refs.works.map((w) => <SelectItem key={w.id} value={w.id}>{w.title}{w.author ? ` · ${w.author}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">작품을 지정해야 &lsquo;관련 문제&rsquo; 단계가 그 작품 문항으로 보충 세트를 만들어요.</p>
          </div>
        </div>
      </section>

      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">단계 ({steps.length})</h2>
          <AddStepMenu onAdd={(kind) => setSteps([...steps, { id: null, title: GUIDE_STEP_KIND_LABEL[kind], payload: emptyPayload(kind) }])} />
        </div>
        <div className="space-y-4 p-4">
          {steps.map((s, i) => (
            <div key={s.id ?? `new-${i}`} className="rounded-md border bg-background">
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                <span className="bg-primary/10 text-primary inline-flex size-7 items-center justify-center rounded-md text-xs font-bold">{i + 1}</span>
                <span className="text-muted-foreground text-xs">{GUIDE_STEP_KIND_LABEL[s.payload.kind]}</span>
                <Input value={s.title} onChange={(e) => update(i, { title: e.target.value })} maxLength={60} className="h-8 w-56 text-sm" placeholder="단계 제목" />
                <div className="ml-auto flex gap-1">
                  <Button type="button" size="icon" variant="ghost" className="size-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label="위로"><ArrowUp className="size-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="size-8" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="아래로"><ArrowDown className="size-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="size-8" disabled={steps.length === 1} onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label="삭제"><Trash2 className="text-destructive size-4" /></Button>
                </div>
              </div>
              <div className="space-y-3 p-3">
                <p className="text-muted-foreground text-xs">{GUIDE_STEP_KIND_HINT[s.payload.kind]}</p>
                <StepPayloadEditor payload={s.payload} refs={{ passages, drills }} onChange={(payload) => update(i, { payload })} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" size="lg"><Link href="/guides">취소</Link></Button>
        <Button size="lg" onClick={save} disabled={pending}>{pending ? "저장 중..." : guideId ? "저장" : "만들기"}</Button>
      </div>
    </div>
  );
}

function AddStepMenu({ onAdd }: { onAdd: (k: GuideStepKind) => void }) {
  return (
    <Select onValueChange={(v) => onAdd(v as GuideStepKind)} value="">
      <SelectTrigger size="sm" className="w-[150px]"><Plus className="size-3.5" /><SelectValue placeholder="단계 추가" /></SelectTrigger>
      <SelectContent>
        {GUIDE_STEP_KIND.map((k) => <SelectItem key={k} value={k}>{GUIDE_STEP_KIND_LABEL[k]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function StepPayloadEditor({
  payload, refs, onChange,
}: {
  payload: GuideStepPayload;
  refs: { passages: GuideEditorRefs["passages"]; drills: GuideEditorRefs["drills"] };
  onChange: (p: GuideStepPayload) => void;
}) {
  if (payload.kind === "intro" || payload.kind === "summary" || payload.kind === "review") {
    return <RichEditor size="small" value={payload.html} onChange={(html) => onChange({ ...payload, html })} placeholder="학생에게 보여줄 글" />;
  }
  if (payload.kind === "read") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">지문 *</Label>
          <Select value={payload.passage_id || NONE} onValueChange={(v) => onChange({ ...payload, passage_id: v === NONE ? "" : v })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="지문 선택" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>선택…</SelectItem>
              {refs.passages.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">읽기 포인트(선택)</Label>
          <Textarea rows={2} value={payload.note ?? ""} maxLength={500} onChange={(e) => onChange({ ...payload, note: e.target.value || null })} placeholder="예: 화자의 태도 변화에 밑줄 치며 읽기" />
        </div>
      </div>
    );
  }
  if (payload.kind === "visual" || payload.kind === "comic") {
    return <ImagesEditor payload={payload} onChange={onChange} />;
  }
  if (payload.kind === "ox") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">훈련 *</Label>
        <Select value={payload.drill_id || NONE} onValueChange={(v) => onChange({ ...payload, drill_id: v === NONE ? "" : v })}>
          <SelectTrigger className="w-full"><SelectValue placeholder="훈련 선택" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>선택…</SelectItem>
            {refs.drills.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}{d.is_published ? "" : " (초안)"}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">초안 훈련은 학생에게 안 보여요 — 가이드 발행 전에 훈련도 발행하세요.</p>
      </div>
    );
  }
  // questions
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs">문항 수</Label>
        <Input type="number" min={3} max={20} value={payload.size} onChange={(e) => onChange({ ...payload, size: Number(e.target.value) || 10 })} className="w-24" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">안내(선택)</Label>
        <Textarea rows={2} value={payload.note ?? ""} maxLength={500} onChange={(e) => onChange({ ...payload, note: e.target.value || null })} />
      </div>
    </div>
  );
}

function ImagesEditor({
  payload, onChange,
}: {
  payload: Extract<GuideStepPayload, { kind: "visual" | "comic" }>;
  onChange: (p: GuideStepPayload) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErr(null);
    setUploading(true);
    const added: typeof payload.images = [];
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", f);
      const r = await uploadGuideImageAction(fd);
      if (!r.ok) { setErr(r.message); break; }
      added.push({ url: r.url, path: r.path, caption: null });
    }
    setUploading(false);
    if (added.length > 0) onChange({ ...payload, images: [...payload.images, ...added] });
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {err && <p className="text-destructive text-xs">{err}</p>}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {payload.images.map((im, i) => (
          <figure key={im.path} className="space-y-1 rounded-md border p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt={im.caption ?? ""} className="h-32 w-full rounded object-cover" />
            <Input value={im.caption ?? ""} maxLength={200} placeholder="설명(선택)" className="h-8 text-xs"
              onChange={(e) => onChange({ ...payload, images: payload.images.map((x, j) => (j === i ? { ...x, caption: e.target.value || null } : x)) })} />
            <Button type="button" size="sm" variant="ghost" className="h-7 w-full text-xs" onClick={() => onChange({ ...payload, images: payload.images.filter((_, j) => j !== i) })}>
              <Trash2 className="size-3.5" /> 빼기
            </Button>
          </figure>
        ))}
        <label className="hover:bg-muted/50 flex h-full min-h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed p-3 text-xs">
          <ImagePlus className="text-muted-foreground size-5" />
          {uploading ? "올리는 중..." : "이미지 추가 (PNG/JPG/WebP, 5MB)"}
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">설명 글(선택)</Label>
        <RichEditor size="small" value={payload.html ?? ""} onChange={(html) => onChange({ ...payload, html: html || null })} placeholder="이미지 아래에 붙는 설명" />
      </div>
    </div>
  );
}
