"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import type { CourseItemInput, DeliveryKind } from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addSessionAction, archiveCourseAction, deleteCourseAction, loadItemRefsAction, updateCourseAction } from "../actions";
import { CourseFields, type CourseFieldsValue } from "../course-fields";
import { SessionCard, type RefsCatalog } from "./session-card";
import { DeliverSheet } from "./deliver-sheet";

export type StudentLite = { id: string; name: string; school: string | null; grade: number | null };
export type DeliveryRow = { session_id: string; student_id: string; kind: DeliveryKind; delivered_at: string };
export type SessionData = { id: string; title: string; summary: string | null; items: CourseItemInput[] };
export type GroupLite = { id: string; name: string; archived: boolean };
export type ItemRefs = {
  materials: { id: string; title: string; audience: "all" | "student" | "parent" | "targeted" | "group"; published: boolean }[];
  tests: { id: string; title: string }[];
  drills: { id: string; title: string; published: boolean }[];
  guides: { id: string; title: string; published: boolean }[];
};

export function CourseDetailClient({
  course,
  linkedGroupIds,
  groups,
  sessions,
  refs,
  deliveries,
}: {
  course: { id: string; title: string; description: string | null; archived: boolean };
  linkedGroupIds: string[];
  groups: GroupLite[];
  sessions: SessionData[];
  refs: ItemRefs;
  deliveries: DeliveryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<CourseFieldsValue>({
    title: course.title,
    description: course.description ?? "",
    groupIds: new Set(linkedGroupIds),
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newSession, setNewSession] = useState("");
  const [sheet, setSheet] = useState<{ sessionId: string; mode: DeliveryKind } | null>(null);

  // 반 선택지: 보관 안 된 반 + 이미 연결돼 있는 보관 반(연결이 화면에서 사라지지 않게)
  const groupOptions = groups.filter((g) => !g.archived || linkedGroupIds.includes(g.id));
  const linkedGroups = groups.filter((g) => linkedGroupIds.includes(g.id));
  // 연결된 반이 없으면(또는 볼 수 있는 연결 반이 없으면) 담당 범위의 모든 반에서 고른다
  const deliverGroups = linkedGroups.length > 0 ? linkedGroups : groups.filter((g) => !g.archived);

  const deliveredBySession = useMemo(() => {
    const m = new Map<string, Map<string, DeliveryRow>>();
    deliveries.forEach((d) => {
      const inner = m.get(d.session_id) ?? new Map<string, DeliveryRow>();
      inner.set(d.student_id, d);
      m.set(d.session_id, inner);
    });
    return m;
  }, [deliveries]);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? "오류가 발생했어요");
      else {
        after?.();
        router.refresh();
      }
    });
  };

  const metaDirty =
    meta.title !== course.title ||
    meta.description !== (course.description ?? "") ||
    meta.groupIds.size !== linkedGroupIds.length ||
    linkedGroupIds.some((g) => !meta.groupIds.has(g));

  const sheetSession = sheet ? sessions.find((s) => s.id === sheet.sessionId) ?? null : null;

  // 피커 선택지 전체(자료·시험지·훈련·가이드) — 첫 편집기를 열 때 한 번만 읽어 모든 카드가 같이 쓴다
  const [catalogRefs, setCatalogRefs] = useState<ItemRefs | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const loadCatalog = useCallback(() => {
    if (catalogRefs || catalogLoading) return;
    setCatalogLoading(true);
    setCatalogError(null);
    loadItemRefsAction()
      .then((r) => {
        if (r.ok) setCatalogRefs(r.refs);
        else setCatalogError(r.message);
      })
      .finally(() => setCatalogLoading(false));
  }, [catalogRefs, catalogLoading]);
  const catalog: RefsCatalog = { refs: catalogRefs, error: catalogError, retry: loadCatalog };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 코스 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">코스 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CourseFields value={meta} onChange={setMeta} groups={groupOptions.map((g) => ({ id: g.id, name: g.archived ? `${g.name} (보관됨)` : g.name }))} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-destructive text-xs">회차·배부 기록·숙제 체크가 모두 지워져요. 삭제할까요?</span>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirmDelete(false)}>
                    취소
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await deleteCourseAction(course.id);
                        if (!r.ok) setError(r.message);
                        else router.push("/courses");
                      })
                    }
                  >
                    삭제
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => archiveCourseAction(course.id, !course.archived))}>
                    {course.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                    {course.archived ? "보관 해제" : "보관"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="text-destructive size-3.5" />
                    삭제
                  </Button>
                </>
              )}
            </div>
            <Button
              size="sm"
              disabled={pending || !metaDirty || meta.title.trim().length < 2}
              onClick={() =>
                run(() =>
                  updateCourseAction(course.id, {
                    title: meta.title,
                    description: meta.description.trim() || null,
                    groupIds: [...meta.groupIds],
                  }),
                )
              }
            >
              코스 정보 저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 회차 */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">회차</h2>
          <p className="text-muted-foreground text-xs">
            회차를 고쳐 저장하면 <b>이미 받은 학생에게도 새 항목이 바로 들어가요</b>(알림은 안 가요). 뺀 항목의 자료·시험 배정은 그대로 남아요.
          </p>
        </div>

        {sessions.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-10 text-center text-sm">
            아직 회차가 없어요. 아래에서 1주차를 추가해보세요.
          </p>
        ) : (
          <ol className="space-y-2">
            {sessions.map((s, i) => (
              <SessionCard
                key={s.id}
                index={i}
                total={sessions.length}
                session={s}
                refs={refs}
                catalog={catalog}
                onOpenEditor={loadCatalog}
                deliveredCount={deliveredBySession.get(s.id)?.size ?? 0}
                onDeliver={(mode) => setSheet({ sessionId: s.id, mode })}
                onError={setError}
              />
            ))}
          </ol>
        )}

        <div className="flex flex-col gap-2 rounded-md border bg-card p-3 sm:flex-row">
          <Input
            value={newSession}
            maxLength={60}
            placeholder={`예) ${sessions.length + 1}주차`}
            onChange={(e) => setNewSession(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && !pending) {
                const t = newSession.trim() || `${sessions.length + 1}주차`;
                run(() => addSessionAction(course.id, t), () => setNewSession(""));
              }
            }}
          />
          <Button
            disabled={pending}
            onClick={() => {
              const t = newSession.trim() || `${sessions.length + 1}주차`;
              run(() => addSessionAction(course.id, t), () => setNewSession(""));
            }}
          >
            <Plus className="size-4" />
            회차 추가
          </Button>
        </div>
      </section>

      <DeliverSheet
        key={sheet ? `${sheet.sessionId}:${sheet.mode}` : "closed"}
        open={sheet !== null && sheetSession !== null}
        onOpenChange={(o) => !o && setSheet(null)}
        mode={sheet?.mode ?? "regular"}
        session={sheetSession}
        groups={deliverGroups}
        usingFallbackGroups={linkedGroups.length === 0}
        delivered={sheet ? deliveredBySession.get(sheet.sessionId) ?? new Map() : new Map()}
      />
    </div>
  );
}
