"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  addGroupMembersAction,
  archiveGroupAction,
  createGroupAction,
  deleteGroupAction,
  removeGroupMemberAction,
} from "./actions";

export type StudentRow = {
  id: string;
  full_name: string;
  school: string | null;
  grade: number | null;
};

export type GroupRow = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  archived: boolean;
  created_at: string;
  member_ids: string[];
};

function studentLine(s: StudentRow): string {
  return [s.school, s.grade ? `${s.grade}학년` : null]
    .filter(Boolean)
    .join(" · ");
}

export function GroupsClient({
  groups,
  students,
}: {
  groups: GroupRow[];
  students: StudentRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const studentById = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students],
  );

  const activeGroup = groups.find((g) => g.id === activeId) ?? null;
  const active = groups.filter((g) => !g.archived);
  const archived = groups.filter((g) => g.archived);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? "오류가 발생했어요");
      else router.refresh();
    });
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const r = await createGroupAction({ name });
      if (!r.ok) setError(r.message);
      else {
        setNewName("");
        router.refresh();
      }
    });
  };

  const memberStudents = activeGroup
    ? activeGroup.member_ids
        .map((id) => studentById.get(id))
        .filter((s): s is StudentRow => Boolean(s))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "ko"))
    : [];

  const addable = activeGroup
    ? students.filter((s) => {
        if (activeGroup.member_ids.includes(s.id)) return false;
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return (
          s.full_name.toLowerCase().includes(q) ||
          (s.school ?? "").toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 새 그룹 만들기 */}
      <div className="flex flex-col gap-2 rounded-md border bg-card p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="new-group" className="text-sm font-medium">
            새 그룹 만들기
          </label>
          <Input
            id="new-group"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="예) 고3 내신반 A, 월수금 7시반"
            maxLength={40}
          />
        </div>
        <Button onClick={handleCreate} disabled={pending || !newName.trim()}>
          <Plus className="size-4" />
          만들기
        </Button>
      </div>

      {/* 그룹 목록 */}
      {active.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-10 text-center text-sm">
          아직 그룹이 없어요. 위에서 첫 그룹을 만들어보세요.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveId(g.id);
                  setQuery("");
                }}
                className="hover:border-primary/40 flex w-full flex-col gap-2 rounded-md border bg-card p-4 text-left transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{g.name}</span>
                  <Badge variant="primary" className="shrink-0">
                    <Users className="size-3" />
                    {g.member_ids.length}
                  </Badge>
                </div>
                {g.description && (
                  <p className="text-muted-foreground line-clamp-2 text-xs">
                    {g.description}
                  </p>
                )}
                <span className="text-muted-foreground text-xs">
                  학생 관리 →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 보관된 그룹 */}
      {archived.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase">
            보관됨
          </h2>
          <ul className="space-y-1.5">
            {archived.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2"
              >
                <span className="text-muted-foreground truncate text-sm">
                  {g.name} · {g.member_ids.length}명
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => archiveGroupAction(g.id, false))}
                  >
                    <ArchiveRestore className="size-3.5" />
                    복원
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => deleteGroupAction(g.id))}
                    aria-label="삭제"
                  >
                    <Trash2 className="text-destructive size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 멤버 관리 Sheet */}
      <Sheet open={activeGroup !== null} onOpenChange={(o) => !o && setActiveId(null)}>
        <SheetContent className="flex flex-col sm:max-w-md">
          {activeGroup && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="truncate text-lg">
                  {activeGroup.name}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  학생 {activeGroup.member_ids.length}명 · 학생을 추가하거나
                  빼면 이 그룹에 배부된 자료·시험이 자동으로 반영돼요.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
                {/* 현재 멤버 */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">이 그룹 학생</h3>
                  {memberStudents.length === 0 ? (
                    <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-sm">
                      아직 학생이 없어요. 아래에서 추가하세요.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-md border">
                      {memberStudents.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-2 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {s.full_name}
                            </p>
                            {studentLine(s) && (
                              <p className="text-muted-foreground truncate text-xs">
                                {studentLine(s)}
                              </p>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={pending}
                            aria-label="빼기"
                            onClick={() =>
                              run(() =>
                                removeGroupMemberAction(activeGroup.id, s.id),
                              )
                            }
                          >
                            <X className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* 학생 추가 */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">학생 추가</h3>
                  <div className="relative">
                    <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="이름/학교 검색"
                      className="pl-9"
                    />
                  </div>
                  {addable.length === 0 ? (
                    <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-sm">
                      {students.length === 0
                        ? "승인된 학생이 없어요."
                        : "추가할 학생이 없어요."}
                    </p>
                  ) : (
                    <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
                      {addable.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-2 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {s.full_name}
                            </p>
                            {studentLine(s) && (
                              <p className="text-muted-foreground truncate text-xs">
                                {studentLine(s)}
                              </p>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={pending}
                            aria-label="추가"
                            onClick={() =>
                              run(() =>
                                addGroupMembersAction(activeGroup.id, [s.id]),
                              )
                            }
                          >
                            <Plus className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {/* 그룹 자체 관리 */}
              <div className="flex items-center justify-end gap-1 border-t px-4 py-3">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => archiveGroupAction(activeGroup.id, true))}
                >
                  <Archive className="size-3.5" />
                  보관
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
