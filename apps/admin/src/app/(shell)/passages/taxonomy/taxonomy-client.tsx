"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  EXAM_KIND,
  PASSAGE_SOURCE,
  WORK_GENRE_PRESETS,
  type ExamKind,
  type PassageSource,
} from "@ipsi/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  archiveConceptAction,
  archiveExamSourceAction,
  archiveQuestionTypeAction,
  archiveWorkAction,
  upsertConceptAction,
  upsertExamSourceAction,
  upsertQuestionTypeAction,
  upsertWorkAction,
} from "./actions";

type TypeRow = { id: string; area: PassageSource; label: string; position: number; archived: boolean; count: number };
type WorkRow = { id: string; title: string; author: string | null; genre: string | null; era: string | null; archived: boolean };
type SourceRow = { id: string; label: string; year: number | null; month: number | null; exam_kind: string | null; grade: number | null; archived: boolean };
type ConceptRow = { id: string; title: string; area: PassageSource | null; parent_id: string | null; archived: boolean };

const NONE = "__none__";

export function TaxonomyClient({
  types,
  works,
  sources,
  concepts,
  areaLabel,
}: {
  types: TypeRow[];
  works: WorkRow[];
  sources: SourceRow[];
  concepts: ConceptRow[];
  areaLabel: Record<PassageSource, string>;
}) {
  return (
    <Tabs defaultValue="types">
      <TabsList>
        <TabsTrigger value="types">유형 {types.filter((t) => !t.archived).length}</TabsTrigger>
        <TabsTrigger value="works">작품·제재 {works.filter((w) => !w.archived).length}</TabsTrigger>
        <TabsTrigger value="sources">기출 출처 {sources.filter((s) => !s.archived).length}</TabsTrigger>
        <TabsTrigger value="concepts">개념 {concepts.filter((c) => !c.archived).length}</TabsTrigger>
      </TabsList>
      <TabsContent value="types"><TypesTab rows={types} areaLabel={areaLabel} /></TabsContent>
      <TabsContent value="works"><WorksTab rows={works} /></TabsContent>
      <TabsContent value="sources"><SourcesTab rows={sources} /></TabsContent>
      <TabsContent value="concepts"><ConceptsTab rows={concepts} areaLabel={areaLabel} /></TabsContent>
    </Tabs>
  );
}

/** 보관/복구 버튼 — 네 탭이 같이 쓴다 */
function ArchiveButton({ archived, onToggle }: { archived: boolean; onToggle: () => Promise<{ ok: boolean }> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await onToggle();
          if (r.ok) router.refresh();
        })
      }
    >
      {archived ? "복구" : "보관"}
    </Button>
  );
}

function Row({ archived, children, actions }: { archived: boolean; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <li className={"flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2.5 " + (archived ? "opacity-50" : "")}>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">{children}{archived && <Badge variant="outline">보관됨</Badge>}</div>
      <div className="flex shrink-0 gap-1">{actions}</div>
    </li>
  );
}

// ── 유형 ──────────────────────────────────────────────────────────────────────
function TypesTab({ rows, areaLabel }: { rows: TypeRow[]; areaLabel: Record<PassageSource, string> }) {
  const router = useRouter();
  const [area, setArea] = useState<PassageSource>("reading");
  const [editing, setEditing] = useState<TypeRow | null | "new">(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await upsertQuestionTypeAction(editing === "new" || !editing ? null : editing.id, { area, label });
      if (!r.ok) return setError(r.message);
      setEditing(null);
      setLabel("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        영역별로 문항 유형을 정해요. 문항 등록 폼에서 그 지문의 영역에 맞는 유형만 고를 수 있어요.
      </p>
      <Tabs value={area} onValueChange={(v) => setArea(v as PassageSource)}>
        <TabsList>
          {PASSAGE_SOURCE.map((s) => (
            <TabsTrigger key={s} value={s}>{areaLabel[s]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ul className="space-y-1.5">
        {rows.filter((r) => r.area === area).map((r) => (
          <Row key={r.id} archived={r.archived} actions={<>
            <Button variant="outline" size="sm" onClick={() => { setEditing(r); setLabel(r.label); }}>편집</Button>
            <ArchiveButton archived={r.archived} onToggle={() => archiveQuestionTypeAction(r.id, !r.archived)} />
          </>}>
            <span className="font-medium">{r.label}</span>
            <span className="text-muted-foreground text-xs">문항 {r.count}</span>
          </Row>
        ))}
      </ul>
      {editing ? (
        <div className="space-y-3 rounded-md border bg-card p-4">
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="space-y-1.5">
            <Label>유형 이름 ({areaLabel[area]})</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} autoFocus placeholder="예: 표현상 특징" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setEditing(null); setLabel(""); }}>취소</Button>
            <Button onClick={save} disabled={pending || !label.trim()}>{pending ? "저장 중..." : "저장"}</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => { setEditing("new"); setLabel(""); }}><Plus className="size-4" />유형 추가</Button>
      )}
    </div>
  );
}

// ── 작품/제재 ─────────────────────────────────────────────────────────────────
function WorksTab({ rows }: { rows: WorkRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<WorkRow | null | "new">(null);
  const [form, setForm] = useState({ title: "", author: "", genre: "", era: "" });
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = (r: WorkRow | "new") => {
    setEditing(r);
    setForm(r === "new" ? { title: "", author: "", genre: "", era: "" } : { title: r.title, author: r.author ?? "", genre: r.genre ?? "", era: r.era ?? "" });
  };
  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await upsertWorkAction(editing === "new" || !editing ? null : editing.id, {
        title: form.title, author: form.author || null, genre: form.genre || null, era: form.era || null,
      });
      if (!r.ok) return setError(r.message);
      setEditing(null);
      router.refresh();
    });
  };
  const q = query.trim();
  const visible = rows.filter((r) => !q || r.title.includes(q) || (r.author ?? "").includes(q));

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        문학 작품과 독서 제재. 지문 등록에서 고르고, 학습 가이드·허브의 단위가 돼요. CSV의 <code>work</code> 열은
        여기 없는 이름이면 자동으로 추가돼요.
      </p>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="작품·작가 검색" />
      <ul className="space-y-1.5">
        {visible.map((r) => (
          <Row key={r.id} archived={r.archived} actions={<>
            <Button variant="outline" size="sm" onClick={() => open(r)}>편집</Button>
            <ArchiveButton archived={r.archived} onToggle={() => archiveWorkAction(r.id, !r.archived)} />
          </>}>
            <span className="font-medium">{r.title}</span>
            {r.author && <span className="text-muted-foreground text-xs">{r.author}</span>}
            {r.genre && <Badge variant="outline">{r.genre}</Badge>}
            {r.era && <span className="text-muted-foreground text-xs">{r.era}</span>}
          </Row>
        ))}
        {visible.length === 0 && <li className="text-muted-foreground rounded-md border border-dashed py-6 text-center text-sm">{q ? "검색 결과가 없어요" : "아직 작품이 없어요"}</li>}
      </ul>
      {editing ? (
        <div className="space-y-3 rounded-md border bg-card p-4">
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>작품/제재명 *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={100} autoFocus /></div>
            <div className="space-y-1.5"><Label>작가</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} maxLength={50} /></div>
            <div className="space-y-1.5">
              <Label>갈래</Label>
              <Select value={form.genre || NONE} onValueChange={(v) => setForm({ ...form, genre: v === NONE ? "" : v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>-</SelectItem>
                  {WORK_GENRE_PRESETS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>시대</Label><Input value={form.era} onChange={(e) => setForm({ ...form, era: e.target.value })} maxLength={30} placeholder="예: 1930년대, 조선 후기" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>취소</Button>
            <Button onClick={save} disabled={pending || !form.title.trim()}>{pending ? "저장 중..." : "저장"}</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => open("new")}><Plus className="size-4" />작품 추가</Button>
      )}
    </div>
  );
}

// ── 기출 출처 ─────────────────────────────────────────────────────────────────
function SourcesTab({ rows }: { rows: SourceRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SourceRow | null | "new">(null);
  const [form, setForm] = useState({ label: "", year: "", month: "", examKind: "" as ExamKind | "", grade: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = (r: SourceRow | "new") => {
    setEditing(r);
    setForm(r === "new"
      ? { label: "", year: "", month: "", examKind: "", grade: "" }
      : { label: r.label, year: r.year?.toString() ?? "", month: r.month?.toString() ?? "", examKind: (r.exam_kind as ExamKind | null) ?? "", grade: r.grade?.toString() ?? "" });
  };
  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await upsertExamSourceAction(editing === "new" || !editing ? null : editing.id, {
        label: form.label,
        year: form.year ? Number(form.year) : null,
        month: form.month ? Number(form.month) : null,
        examKind: form.examKind || null,
        grade: form.grade ? Number(form.grade) : null,
      });
      if (!r.ok) return setError(r.message);
      setEditing(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        기출 출처(예: 2024학년도 9월 모평 고3). 지문 등록에서 고르고, 출처 표기와 &ldquo;이 개념이 나온 기출&rdquo;에 쓰여요.
        CSV의 <code>source</code> 열은 여기 없는 이름이면 자동으로 추가돼요.
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <Row key={r.id} archived={r.archived} actions={<>
            <Button variant="outline" size="sm" onClick={() => open(r)}>편집</Button>
            <ArchiveButton archived={r.archived} onToggle={() => archiveExamSourceAction(r.id, !r.archived)} />
          </>}>
            <span className="font-medium">{r.label}</span>
            {r.exam_kind && <Badge variant="outline">{r.exam_kind}</Badge>}
            {(r.year || r.month) && <span className="text-muted-foreground text-xs">{r.year ?? ""}{r.month ? `.${r.month}` : ""}</span>}
            {r.grade && <span className="text-muted-foreground text-xs">고{r.grade}</span>}
          </Row>
        ))}
        {rows.length === 0 && <li className="text-muted-foreground rounded-md border border-dashed py-6 text-center text-sm">아직 출처가 없어요</li>}
      </ul>
      {editing ? (
        <div className="space-y-3 rounded-md border bg-card p-4">
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>표시명 *</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={60} autoFocus placeholder="예: 2024학년도 9월 모평 고3" /></div>
            <div className="space-y-1.5"><Label>학년도</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} min={2000} max={2100} /></div>
            <div className="space-y-1.5"><Label>월</Label><Input type="number" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} min={1} max={12} /></div>
            <div className="space-y-1.5">
              <Label>구분</Label>
              <Select value={form.examKind || NONE} onValueChange={(v) => setForm({ ...form, examKind: v === NONE ? "" : (v as ExamKind) })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>-</SelectItem>
                  {EXAM_KIND.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>학년</Label>
              <Select value={form.grade || NONE} onValueChange={(v) => setForm({ ...form, grade: v === NONE ? "" : v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>-</SelectItem>
                  {[1, 2, 3].map((g) => <SelectItem key={g} value={String(g)}>고{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>취소</Button>
            <Button onClick={save} disabled={pending || !form.label.trim()}>{pending ? "저장 중..." : "저장"}</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => open("new")}><Plus className="size-4" />출처 추가</Button>
      )}
    </div>
  );
}

// ── 개념 ──────────────────────────────────────────────────────────────────────
function ConceptsTab({ rows, areaLabel }: { rows: ConceptRow[]; areaLabel: Record<PassageSource, string> }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ConceptRow | null | "new">(null);
  const [form, setForm] = useState({ title: "", area: "" as PassageSource | "", parentId: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const titleOf = new Map(rows.map((r) => [r.id, r.title] as const));

  const open = (r: ConceptRow | "new") => {
    setEditing(r);
    setForm(r === "new" ? { title: "", area: "", parentId: "" } : { title: r.title, area: r.area ?? "", parentId: r.parent_id ?? "" });
  };
  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await upsertConceptAction(editing === "new" || !editing ? null : editing.id, {
        title: form.title, area: form.area || null, parentId: form.parentId || null,
      });
      if (!r.ok) return setError(r.message);
      setEditing(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        개념(초점화, 품사, 논증 구조 …). 문항에 여러 개를 달 수 있고, 취약 개념 분석과 개념 허브의 단위가 돼요.
        상위 개념을 두면 묶어 볼 수 있어요.
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <Row key={r.id} archived={r.archived} actions={<>
            <Button variant="outline" size="sm" onClick={() => open(r)}>편집</Button>
            <ArchiveButton archived={r.archived} onToggle={() => archiveConceptAction(r.id, !r.archived)} />
          </>}>
            {r.parent_id && titleOf.get(r.parent_id) && <span className="text-muted-foreground text-xs">{titleOf.get(r.parent_id)} ›</span>}
            <span className="font-medium">{r.title}</span>
            {r.area && <Badge variant="outline">{areaLabel[r.area]}</Badge>}
          </Row>
        ))}
        {rows.length === 0 && <li className="text-muted-foreground rounded-md border border-dashed py-6 text-center text-sm">아직 개념이 없어요</li>}
      </ul>
      {editing ? (
        <div className="space-y-3 rounded-md border bg-card p-4">
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>개념 이름 *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={60} autoFocus /></div>
            <div className="space-y-1.5">
              <Label>영역</Label>
              <Select value={form.area || NONE} onValueChange={(v) => setForm({ ...form, area: v === NONE ? "" : (v as PassageSource) })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>공통</SelectItem>
                  {PASSAGE_SOURCE.map((s) => <SelectItem key={s} value={s}>{areaLabel[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>상위 개념</Label>
              <Select value={form.parentId || NONE} onValueChange={(v) => setForm({ ...form, parentId: v === NONE ? "" : v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>없음</SelectItem>
                  {rows.filter((r) => !r.archived && (editing === "new" || r.id !== editing?.id)).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>취소</Button>
            <Button onClick={save} disabled={pending || !form.title.trim()}>{pending ? "저장 중..." : "저장"}</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => open("new")}><Plus className="size-4" />개념 추가</Button>
      )}
    </div>
  );
}
