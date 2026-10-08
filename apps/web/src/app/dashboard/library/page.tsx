import Link from "next/link";
import { redirect } from "next/navigation";
import { BookMarked, Library } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import {
  LIBRARY_KIND,
  LIBRARY_KIND_LABEL,
  PASSAGE_SOURCE_LABEL,
  libraryIndexSchema,
  type LibraryKind,
  type PassageSource,
} from "@ipsi/types";
import { readAuthState } from "@/lib/auth-state";
import { getMyNotifications } from "@/lib/notifications";
import { Badge } from "@/components/ui/badge";
import { LibraryShell } from "./shell";

export const dynamic = "force-dynamic";

/**
 * 작품·개념·기출 허브 — 사이트 안의 지문/문항/훈련/내 성취도가 따로 놀지 않게 묶는 입구.
 * 메타만(library_index). 본문은 시험·가이드 안에서만.
 */
export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: LibraryKind = (LIBRARY_KIND as readonly string[]).includes(tabParam ?? "") ? (tabParam as LibraryKind) : "work";
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");
  if (state.kind !== "ok") return null;

  const [notif, { data }] = await Promise.all([getMyNotifications(supabase, state.userId), supabase.rpc("library_index")]);
  const parsed = libraryIndexSchema.safeParse(data);
  const idx = parsed.success ? parsed.data : null;

  return (
    <LibraryShell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <div className="space-y-1">
        <h1 className="font-display text-[34px] leading-tight">작품·개념·기출</h1>
        <p className="text-muted-foreground text-sm">
          작품 하나, 개념 하나를 고르면 관련 지문·기출·문항·훈련·내 성취도가 한 자리에 모여요.
        </p>
      </div>

      <nav aria-label="분류" className="flex flex-wrap gap-2">
        {LIBRARY_KIND.map((k) => (
          <Link
            key={k}
            href={`/dashboard/library?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={
              "rounded-full border px-3 py-1 text-xs font-bold transition-colors " +
              (tab === k ? "border-primary bg-primary text-primary-foreground" : "border-hairline bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground")
            }
          >
            {LIBRARY_KIND_LABEL[k]}
            {idx && <span className="ml-1 opacity-70">{k === "work" ? idx.works.length : k === "concept" ? idx.concepts.length : idx.sources.length}</span>}
          </Link>
        ))}
      </nav>

      {!idx ? (
        <Empty text="목록을 불러오지 못했어요." />
      ) : tab === "work" ? (
        idx.works.length === 0 ? (
          <Empty text="아직 등록된 작품이 없어요. 선생님이 지문에 작품을 지정하면 여기 모여요." />
        ) : (
          <ul className="space-y-2">
            {idx.works.map((w) => (
              <Row key={w.id} href={`/dashboard/library/work/${w.id}`} title={w.title} sub={[w.author, w.genre, w.era].filter(Boolean).join(" · ")}
                badges={[`지문 ${w.passages}`, `문항 ${w.questions}`, ...(w.drills > 0 ? [`훈련 ${w.drills}`] : [])]} />
            ))}
          </ul>
        )
      ) : tab === "concept" ? (
        idx.concepts.length === 0 ? (
          <Empty text="아직 등록된 개념이 없어요." />
        ) : (
          <ul className="space-y-2">
            {idx.concepts.map((c) => (
              <Row key={c.id} href={`/dashboard/library/concept/${c.id}`} title={c.title}
                sub={[c.area ? PASSAGE_SOURCE_LABEL[c.area as PassageSource] : "공통", c.has_body ? "개념 설명 있음" : null].filter(Boolean).join(" · ")}
                badges={[`문항 ${c.questions}`, ...(c.drills > 0 ? [`훈련 ${c.drills}`] : [])]} />
            ))}
          </ul>
        )
      ) : idx.sources.length === 0 ? (
        <Empty text="아직 등록된 기출 출처가 없어요." />
      ) : (
        <ul className="space-y-2">
          {idx.sources.map((s) => (
            <Row key={s.id} href={`/dashboard/library/source/${s.id}`} title={s.label}
              sub={[s.exam_kind, s.year ? `${s.year}학년도` : null, s.grade ? `고${s.grade}` : null].filter(Boolean).join(" · ")}
              badges={[`지문 ${s.passages}`, `문항 ${s.questions}`]} />
          ))}
        </ul>
      )}
    </LibraryShell>
  );
}

function Row({ href, title, sub, badges }: { href: string; title: string; sub: string; badges: string[] }) {
  return (
    <li>
      <Link href={href} className="border-hairline bg-surface hover:border-primary/40 flex items-center justify-between gap-3 rounded-[14px] border p-4 transition-colors">
        <div className="flex min-w-0 items-center gap-3">
          <BookMarked className="text-primary size-5 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-bold">{title}</p>
            {sub && <p className="text-muted-foreground truncate text-xs">{sub}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {badges.map((b) => <Badge key={b} variant="outline">{b}</Badge>)}
        </div>
      </Link>
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="border-hairline bg-surface rounded-[14px] border p-8 text-center">
      <Library className="text-muted-foreground mx-auto size-8" />
      <p className="text-muted-foreground mt-3 text-sm">{text}</p>
    </div>
  );
}
