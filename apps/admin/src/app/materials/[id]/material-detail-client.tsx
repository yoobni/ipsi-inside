"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  EyeOff,
  Pencil,
  Send,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  MATERIAL_AUDIENCE_LABEL,
  type MaterialAudience,
} from "@ipsi/types";
import { formatBytes } from "@ipsi/lib/format";
import type { GroupOption } from "../new-form";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchedulePublishButton } from "@/components/schedule-publish-popover";
import {
  assignMaterialAction,
  deleteMaterialAction,
  togglePublishMaterialAction,
  unassignMaterialAction,
  updateMaterialAction,
} from "../actions";

export type MaterialFileRow = {
  id: string;
  file_name: string;
  file_size_bytes: number;
  position: number;
};

export type MaterialDetail = {
  id: string;
  title: string;
  description: string | null;
  audience: MaterialAudience;
  files: MaterialFileRow[];
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type AssignedRow = {
  assignment_id: string;
  student_id: string;
  full_name: string;
  school: string | null;
  grade: number | null;
  assigned_at: string;
  assigned_by_school: string | null;
};

export type AvailableStudent = {
  id: string;
  full_name: string;
  phone: string;
  school: string | null;
  grade: number | null;
};

export function MaterialDetailClient({
  material,
  assigned,
  availableStudents,
  distinctSchools,
  groups,
  targetGroupIds,
}: {
  material: MaterialDetail;
  assigned: AssignedRow[];
  availableStudents: AvailableStudent[];
  distinctSchools: string[];
  groups: GroupOption[];
  targetGroupIds: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const targetGroups = groups.filter((g) => targetGroupIds.includes(g.id));

  const isExpired =
    material.expires_at != null && new Date(material.expires_at) < new Date();
  const totalSize = formatBytes(
    material.files.reduce((s, f) => s + f.file_size_bytes, 0),
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{material.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={material.is_published ? "success" : "outline"}>
              {material.is_published ? "발행" : "초안"}
            </Badge>
            <Badge variant="primary">
              {MATERIAL_AUDIENCE_LABEL[material.audience]}
            </Badge>
            {isExpired && <Badge variant="warning">만료</Badge>}
          </div>
          {material.description && (
            <p className="text-muted-foreground text-sm">{material.description}</p>
          )}
          <p className="text-muted-foreground text-xs">
            파일 {material.files.length}개 · {totalSize}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToggleButton material={material} />
          {!material.is_published && (
            <SchedulePublishButton
              onPublish={(iso) =>
                togglePublishMaterialAction(material.id, true, iso)
              }
            />
          )}
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> 편집
          </Button>
          <DeleteButton material={material} />
        </div>
      </div>

      <section className="rounded-md border bg-card">
        <div className="grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs">생성</p>
            <p className="mt-0.5 tabular-nums">{formatDt(material.created_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">발행</p>
            <p className="mt-0.5 tabular-nums">
              {material.published_at ? formatDt(material.published_at) : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">만료</p>
            <p className="mt-0.5 tabular-nums">
              {material.expires_at ? formatDt(material.expires_at) : "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            파일 ({material.files.length})
          </h2>
        </div>
        {material.files.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm">
            파일이 없어요.
          </p>
        ) : (
          <ul className="divide-y">
            {material.files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 px-4 py-2.5"
              >
                <span className="min-w-0 truncate text-sm">
                  <span className="text-muted-foreground mr-1.5 tabular-nums">
                    {f.position}.
                  </span>
                  {f.file_name}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {formatBytes(f.file_size_bytes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {material.audience === "targeted" && (
        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">배정 학생</h2>
              <Badge variant="primary">{assigned.length}명 배정</Badge>
            </div>
            <Button size="sm" onClick={() => setAssignOpen(true)}>
              <UserPlus className="size-4" />
              배정 추가
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">이름</TableHead>
                <TableHead>소속</TableHead>
                <TableHead className="pr-4 text-right">배정일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assigned.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-muted-foreground h-24 text-center"
                  >
                    배정된 학생이 없어요. [배정 추가]로 학교/학생을 선택하세요.
                  </TableCell>
                </TableRow>
              ) : (
                assigned.map((r) => (
                  <AssignedRowItem key={r.assignment_id} row={r} materialId={material.id} />
                ))
              )}
            </TableBody>
          </Table>
        </section>
      )}

      {material.audience === "group" && (
        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">대상 그룹</h2>
              <Badge variant="primary">{targetGroups.length}개 그룹</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> 그룹 변경
            </Button>
          </div>
          <div className="p-4">
            {targetGroups.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                연결된 그룹이 없어요. [그룹 변경]에서 대상 그룹을 선택하세요.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {targetGroups.map((g) => (
                  <Badge key={g.id} variant="default">
                    {g.name} · {g.member_count}명
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-muted-foreground mt-3 text-xs">
              그룹 멤버가 바뀌면 노출 대상도 자동으로 따라가요. (동적)
            </p>
          </div>
        </section>
      )}

      {material.audience !== "targeted" && material.audience !== "group" && (
        <section className="rounded-md border bg-card px-4 py-6">
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">광역 배부</strong> 모드에선 별도 배정이
            필요 없어요. 발행하면 대상 사용자 전원에게 알림이 발송돼요.
          </p>
        </section>
      )}

      <EditDrawer
        open={editing}
        onClose={() => setEditing(false)}
        material={material}
        groups={groups}
        initialGroupIds={targetGroupIds}
      />
      <AssignDrawer
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        materialId={material.id}
        availableStudents={availableStudents}
        distinctSchools={distinctSchools}
      />
    </>
  );
}

function ToggleButton({ material }: { material: MaterialDetail }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    if (material.is_published && !confirm("이 자료의 발행을 내릴까요?")) return;
    setError(null);
    startTransition(async () => {
      const r = await togglePublishMaterialAction(
        material.id,
        !material.is_published,
      );
      if (!r.ok) setError(r.message);
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleToggle} disabled={pending}>
        {material.is_published ? (
          <>
            <EyeOff className="size-4" />
            내림
          </>
        ) : (
          <>
            <Send className="size-4" />
            발행
          </>
        )}
      </Button>
      {error && (
        <Alert variant="destructive" className="basis-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

function DeleteButton({ material }: { material: MaterialDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    if (
      !confirm(
        "이 자료를 삭제할까요? 학생/학부모는 더 이상 다운로드할 수 없게 돼요.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await deleteMaterialAction(material.id);
      if (r.ok) router.push("/materials");
      else setError(r.message);
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
      >
        <Trash2 className="text-destructive size-4" /> 삭제
      </Button>
      {error && (
        <Alert variant="destructive" className="basis-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

function AssignedRowItem({
  row,
  materialId,
}: {
  row: AssignedRow;
  materialId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleUnassign = () => {
    if (!confirm("이 학생의 배정을 해제할까요?")) return;
    setError(null);
    startTransition(async () => {
      const r = await unassignMaterialAction(materialId, row.student_id);
      if (!r.ok) setError(r.message);
    });
  };

  return (
    <>
      <TableRow>
        <TableCell className="pl-4">
          <div className="font-medium">{row.full_name}</div>
          {row.assigned_by_school && (
            <div className="text-muted-foreground text-xs">
              학교 단위 배정: {row.assigned_by_school}
            </div>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {row.school}
          {row.grade ? ` · ${row.grade}학년` : ""}
        </TableCell>
        <TableCell className="text-muted-foreground pr-4 text-right text-xs">
          <div className="inline-flex items-center gap-1">
            <span>{new Date(row.assigned_at).toLocaleDateString("ko-KR")}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={pending}
              onClick={handleUnassign}
              className="size-7"
              aria-label="배정 해제"
            >
              <Trash2 className="text-destructive size-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {error && (
        <TableRow>
          <TableCell colSpan={3} className="pl-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function EditDrawer({
  open,
  onClose,
  material,
  groups,
  initialGroupIds,
}: {
  open: boolean;
  onClose: () => void;
  material: MaterialDetail;
  groups: GroupOption[];
  initialGroupIds: string[];
}) {
  const [title, setTitle] = useState(material.title);
  const [description, setDescription] = useState(material.description ?? "");
  const [audience, setAudience] = useState<MaterialAudience>(material.audience);
  const [groupIds, setGroupIds] = useState<Set<string>>(
    new Set(initialGroupIds),
  );
  const [expiresAt, setExpiresAt] = useState(isoToLocal(material.expires_at));
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
    if (audience === "group" && groupIds.size === 0) {
      setError("대상 그룹을 최소 1개 선택해주세요.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("description", description.trim());
    fd.set("audience", audience);
    fd.set("expires_at", expiresAt ? localToIso(expiresAt) ?? "" : "");
    if (audience === "group") {
      fd.set("group_ids", JSON.stringify(Array.from(groupIds)));
    }
    startTransition(async () => {
      const r = await updateMaterialAction(material.id, null, fd);
      if (r.ok) onClose();
      else setError(r.message);
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>자료 편집</SheetTitle>
          <SheetDescription>
            제목/설명/배부 대상/만료 일시를 수정. 파일은 교체할 수 없어요 — 교체하려면 새 자료로 등록하세요.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">제목 *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
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
                    {MATERIAL_AUDIENCE_LABEL.targeted}
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
              {material.audience === "targeted" && audience !== "targeted" && (
                <p className="text-xs text-amber-600">
                  핀포인트 → 광역으로 바꾸면 기존 배정 학생 행은 남지만 광역
                  audience에 의해 모두에게 노출돼요.
                </p>
              )}
            </div>

            {audience === "group" && (
              <div className="space-y-1.5">
                <Label>대상 그룹</Label>
                {groups.length === 0 ? (
                  <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-xs">
                    만든 그룹이 없어요. [그룹(반)] 메뉴에서 먼저 만들어주세요.
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
                          <span className="flex-1 text-sm font-medium">
                            {g.name}
                          </span>
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
            <div className="space-y-2">
              <Label htmlFor="expires">만료 일시 (선택)</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
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

function AssignDrawer({
  open,
  onClose,
  materialId,
  availableStudents,
  distinctSchools,
}: {
  open: boolean;
  onClose: () => void;
  materialId: string;
  availableStudents: AvailableStudent[];
  distinctSchools: string[];
}) {
  const [tab, setTab] = useState<"school" | "student">("school");
  const [selectedSchools, setSelectedSchools] = useState<Set<string>>(new Set());
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filteredStudents = useMemo(() => {
    const q = query.trim();
    if (!q) return availableStudents;
    return availableStudents.filter(
      (s) => s.full_name.includes(q) || s.phone.includes(q),
    );
  }, [availableStudents, query]);

  const studentsBySchool = useMemo(() => {
    const m = new Map<string, number>();
    availableStudents.forEach((s) => {
      if (s.school) m.set(s.school, (m.get(s.school) ?? 0) + 1);
    });
    return m;
  }, [availableStudents]);

  const toggleSchool = (s: string) => {
    setSelectedSchools((p) => {
      const next = new Set(p);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = () => {
    if (selectedSchools.size === 0 && selectedStudents.size === 0) {
      setError("학교 또는 학생을 선택해주세요");
      return;
    }
    setError(null);
    const payload = {
      material_id: materialId,
      schools: Array.from(selectedSchools),
      student_ids: Array.from(selectedStudents),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    startTransition(async () => {
      const r = await assignMaterialAction(null, fd);
      if (r.ok) {
        setSelectedSchools(new Set());
        setSelectedStudents(new Set());
        onClose();
      } else {
        setError(r.message);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>배정 추가</SheetTitle>
          <SheetDescription>
            학교 선택 시 해당 학교 활성 학생 전체가 배정돼요. 개별 학생 추가도 가능.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "school" | "student")}>
            <TabsList className="w-full">
              <TabsTrigger value="school" className="flex-1">
                학교 {selectedSchools.size > 0 ? `(${selectedSchools.size})` : ""}
              </TabsTrigger>
              <TabsTrigger value="student" className="flex-1">
                학생 {selectedStudents.size > 0 ? `(${selectedStudents.size})` : ""}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "school" ? (
            distinctSchools.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
                활성 학생의 학교 정보가 없어요.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {distinctSchools.map((s) => {
                  const checked = selectedSchools.has(s);
                  const count = studentsBySchool.get(s) ?? 0;
                  return (
                    <li key={s}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSchool(s)}
                          className="size-4 accent-current"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{s}</p>
                          <p className="text-muted-foreground text-xs">
                            배정 가능 {count}명
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <>
              <Input
                type="search"
                placeholder="이름/전화 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {filteredStudents.length === 0 ? (
                <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
                  {availableStudents.length === 0
                    ? "배정 가능한 학생이 없어요."
                    : `"${query}" 결과 없음`}
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {filteredStudents.map((s) => {
                    const checked = selectedStudents.has(s.id);
                    return (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStudent(s.id)}
                            className="size-4 accent-current"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {s.full_name}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {s.phone}
                              {s.school ? ` · ${s.school}` : ""}
                              {s.grade ? ` ${s.grade}학년` : ""}
                            </p>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter className="border-t">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm">
              학교 {selectedSchools.size} · 학생 {selectedStudents.size}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                type="button"
                disabled={pending}
              >
                취소
              </Button>
              <Button
                onClick={handleAssign}
                disabled={
                  pending ||
                  (selectedSchools.size === 0 && selectedStudents.size === 0)
                }
              >
                {pending ? "처리 중..." : "배정"}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function formatDt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
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
