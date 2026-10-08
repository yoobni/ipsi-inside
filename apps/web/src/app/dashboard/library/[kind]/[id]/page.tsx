import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Puzzle } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import {
  DRILL_KIND_LABEL,
  LIBRARY_KIND,
  LIBRARY_KIND_LABEL,
  PASSAGE_SOURCE_LABEL,
  PRACTICE_SET_SIZE,
  libraryDetailSchema,
  type DrillKind,
  type LibraryKind,
  type PassageSource,
} from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import { getMyNotifications } from "@/lib/notifications";
import { deriveMastery, getStudentMastery } from "@/lib/mastery";
import { Badge } from "@/components/ui/badge";
import { DeltaBadge } from "@/components/delta-badge";
import { PracticeButton } from "../../../stats/practice-button";
import { LibraryShell } from "../../shell";

export const dynamic = "force-dynamic";

/**
 * 작품/개념/기출 상세 — 관련 지문(제목만) → 기출 → 유형별 문항 수 → 훈련 → 내 성취도 →
 * 보충 풀기. 지문 본문·정답은 여기 없다(시험·가이드 안에서만).
 */
export default async function LibraryDetailPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!(LIBRARY_KIND as readonly string[]).includes(kind)) notFound();
  const k = kind as LibraryKind;

  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");
  if (state.kind !== "ok") return null;

  // 학부모는 첫 자녀 기준으로 성취도
  let targetId: string | null = state.role === "student" ? state.userId : null;
  if (state.role === "parent") {
    const { data: links } = await supabase.from("parent_student_links").select("student_id").eq("parent_id", state.userId).limit(1);
    targetId = links?.[0]?.student_id ?? null;
  }

  const [notif, { data }, mastery] = await Promise.all([
    getMyNotifications(supabase, state.userId),
    supabase.rpc("library_detail", { p_kind: k, p_id: id }),
    targetId ? getStudentMastery(supabase, targetId) : Promise.resolve(null),
  ]);
  const parsed = data == null ? null : libraryDetailSchema.safeParse(data);
  if (!parsed || !parsed.success) notFound();
  const d = parsed.data;
  const head = d.head as Record<string, string | null | undefined> & { parent?: { id: string; title: string } | null };

  // 내 성취도 — 같은 태그 행
  const mine = mastery
    ? deriveMastery(mastery).tags.find((t) => (k === "work" ? t.kind === "work" : k === "concept" ? t.kind === "concept" : false) && t.id === id) ?? null
    : null;

  const title = String(head.title ?? "");
  const subtitle =
    k === "work"
      ? [head.author, head.genre, head.era].filter(Boolean).join(" · ")
      : k === "concept"
        ? [head.area ? PASSAGE_SOURCE_LABEL[head.area as PassageSource] : "공통", head.parent?.title ? `상위: ${head.parent.title}` : null].filter(Boolean).join(" · ")
        : [head.exam_kind, head.year ? `${head.year}학년도` : null, head.month ? `${head.month}월` : null, head.grade ? `고${head.grade}` : null].filter(Boolean).join(" · ");

  return (
    <LibraryShell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <Link href={`/dashboard/library?tab=${k}`} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground">
        <ChevronLeft className="size-3.5" />
        {LIBRARY_KIND_LABEL[k]}
      </Link>

      <div className="space-y-1">
        <Badge variant="primary">{LIBRARY_KIND_LABEL[k]}</Badge>
        <h1 className="font-display text-[30px] leading-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>

      {/* 개념 설명 */}
      {k === "concept" && head.body_html && (
        <section className="border-hairline bg-surface rounded-[14px] border p-5">
          <h2 className="mb-2 text-sm font-extrabold">개념 설명</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: String(head.body_html) }} />
        </section>
      )}

      {/* 내 성취도 + 보충 */}
      {targetId && (
        <section className="border-primary/30 bg-primary/5 rounded-[14px] border p-5">
          <h2 className="text-sm font-extrabold">{state.role === "parent" ? "자녀의 성취도" : "내 성취도"}</h2>
          {mine ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-primary text-2xl font-black tabular-nums">{mine.rate}%</span>
              <span className="text-muted-foreground text-xs">최근 180일 {mine.total}문항</span>
              <DeltaBadge delta={mine.trend} />
              {mine.weak && <Badge variant="warning">⚠ 취약</Badge>}
              {state.role === "student" && mine.weak && (mine.kind === "work" || mine.kind === "concept") && (
                <PracticeButton tagKind={mine.kind} tagId={mine.id} size={PRACTICE_SET_SIZE} />
              )}
            </div>
          ) : (
            <p className="text-muted-foreground mt-1 text-xs">
              {k === "source" ? "기출 출처 단위로는 성취도를 따로 집계하지 않아요." : "아직 이 태그의 문항을 푼 기록이 없어요."}
            </p>
          )}
        </section>
      )}

      {/* 관련 지문 */}
      <section className="border-hairline bg-surface rounded-[14px] border p-5">
        <h2 className="text-sm font-extrabold">
          관련 지문 <span className="text-muted-foreground text-xs font-normal">{d.passages.length}개 · 문항 {d.question_count}</span>
        </h2>
        {d.passages.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-xs">연결된 지문이 아직 없어요.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {d.passages.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {PASSAGE_SOURCE_LABEL[p.source_type as PassageSource] ?? p.source_type}
                    {k !== "source" && p.source ? ` · ${p.source}` : ""}
                    {k !== "work" && p.work ? ` · ${p.work}` : ""}
                  </p>
                </div>
                <Badge variant="outline">문항 {p.questions}</Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground mt-2 text-[11px]">지문 본문과 문항은 시험·보충 세트·학습 가이드 안에서 풀어요.</p>
      </section>

      {/* 유형별 문항 수 */}
      {d.by_type.length > 0 && (
        <section className="border-hairline bg-surface rounded-[14px] border p-5">
          <h2 className="text-sm font-extrabold">출제 유형</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.by_type.map((t) => (
              <Badge key={t.type_id ?? "none"} variant="outline">{t.label} {t.count}</Badge>
            ))}
          </div>
        </section>
      )}

      {/* 연결: 기출 / 작품 / 개념 */}
      {(d.sources.length > 0 || d.works.length > 0 || d.concepts.length > 0) && (
        <section className="border-hairline bg-surface rounded-[14px] border p-5">
          <h2 className="text-sm font-extrabold">연결</h2>
          <div className="mt-2 space-y-2 text-sm">
            {d.sources.length > 0 && (
              <p><span className="text-muted-foreground mr-2 text-xs">출제된 기출</span>{d.sources.map((s) => <Link key={s.id} href={`/dashboard/library/source/${s.id}`} className="hover:text-primary mr-2 underline">{s.label}</Link>)}</p>
            )}
            {d.works.length > 0 && (
              <p><span className="text-muted-foreground mr-2 text-xs">작품</span>{d.works.map((w) => <Link key={w.id} href={`/dashboard/library/work/${w.id}`} className="hover:text-primary mr-2 underline">{w.title}{w.author ? `(${w.author})` : ""}</Link>)}</p>
            )}
            {d.concepts.length > 0 && (
              <p><span className="text-muted-foreground mr-2 text-xs">개념</span>{d.concepts.map((c) => <Link key={c.id} href={`/dashboard/library/concept/${c.id}`} className="hover:text-primary mr-2 underline">{c.title}</Link>)}</p>
            )}
          </div>
        </section>
      )}

      {/* 훈련 */}
      {d.drills.length > 0 && (
        <section className="border-hairline bg-surface rounded-[14px] border p-5">
          <h2 className="text-sm font-extrabold">훈련</h2>
          <ul className="mt-2 space-y-1.5">
            {d.drills.map((dr) => (
              <li key={dr.id}>
                <Link href={`/dashboard/drills/${dr.id}`} className="hover:border-primary/40 border-hairline flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors">
                  <Puzzle className="text-primary size-4" />
                  <Badge variant="outline">{DRILL_KIND_LABEL[dr.kind as DrillKind] ?? dr.kind}</Badge>
                  <span className="truncate">{dr.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </LibraryShell>
  );
}
