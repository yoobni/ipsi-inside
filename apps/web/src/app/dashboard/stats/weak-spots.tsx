import Link from "next/link";
import { Target } from "lucide-react";
import {
  MASTERY_MIN_TOTAL,
  MASTERY_WEAK_BELOW,
  PRACTICE_SET_SIZE,
  PRACTICE_TAG_KIND_LABEL,
  type StudentMastery,
} from "@ipsi/types";
import { DeltaBadge } from "@/components/delta-badge";
import { deriveMastery, type MasteryRow } from "@/lib/mastery";
import { PracticeButton } from "./practice-button";

export type PracticeSetRow = {
  id: string;
  sheet_id: string;
  tag_label: string;
  tag_kind: string;
  created_at: string;
  /** 최고 점수율(%) — 응시 없으면 null */
  best: number | null;
};

/**
 * 누적 취약점 + 보충 세트. 취약(8문항↑·65% 미만) 태그마다 "보충 10문제 풀기".
 * 학부모는 보기만(버튼 없음).
 */
export function WeakSpots({
  mastery,
  practiceSets,
  canPractice,
}: {
  mastery: StudentMastery;
  practiceSets: PracticeSetRow[];
  canPractice: boolean;
}) {
  const d = deriveMastery(mastery);
  const hasAny = d.tags.length > 0 || d.areas.length > 0;
  if (!hasAny && practiceSets.length === 0) return null;

  // 취약이 없으면 가장 낮은 3개라도(참고용, 버튼은 취약만)
  const list: MasteryRow[] = d.weak.length > 0 ? d.weak.slice(0, 6) : d.tags.filter((t) => t.total >= 3).sort((a, b) => a.rate - b.rate).slice(0, 3);

  return (
    <section className="border-hairline bg-surface rounded-[14px] border p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold">
            <Target className="text-primary size-4" />
            누적 취약점과 보충
          </h2>
          <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
            최근 {mastery.window_days}일 시험(가장 잘 본 응시)과 훈련(첫 시도)을 유형·작품·개념별로 모았어요.
            {MASTERY_MIN_TOTAL}문항 이상 풀고 {MASTERY_WEAK_BELOW}% 미만이면 취약으로 표시해요.
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-5 text-center text-xs">
          유형·작품·개념이 태그된 문항을 더 풀면 어디가 약한지 보여요.
          {mastery.untyped_questions > 0 && ` (유형 미지정 문항 ${mastery.untyped_questions}개는 집계에서 뺐어요)`}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((t) => (
            <li key={`${t.kind}-${t.id}`} className="border-hairline flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2.5">
              <span className="text-muted-foreground w-9 shrink-0 text-[11px]">{PRACTICE_TAG_KIND_LABEL[t.kind as keyof typeof PRACTICE_TAG_KIND_LABEL] ?? t.kind}</span>
              <span className={"min-w-0 flex-1 truncate text-sm " + (t.weak ? "text-primary font-bold" : "font-medium")}>
                {t.label}
                {t.weak && <span className="ml-1 text-[10px]">⚠ 취약</span>}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {t.rate}% ({t.total}문항)
              </span>
              <DeltaBadge delta={t.trend} />
              {canPractice && t.weak && t.kind !== "area" && (
                <PracticeButton tagKind={t.kind} tagId={t.id} size={PRACTICE_SET_SIZE} />
              )}
            </li>
          ))}
        </ul>
      )}

      {d.strong.length > 0 && (
        <p className="text-muted-foreground mt-3 text-[11px]">
          잘하는 것: {d.strong.slice(0, 3).map((s) => `${s.label} ${s.rate}%`).join(" · ")}
        </p>
      )}

      {practiceSets.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold">내 보충 세트</h3>
          <ul className="mt-1.5 space-y-1">
            {practiceSets.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <Link href={`/dashboard/tests/${p.sheet_id}`} className="hover:text-primary truncate hover:underline">
                  [{PRACTICE_TAG_KIND_LABEL[p.tag_kind as keyof typeof PRACTICE_TAG_KIND_LABEL] ?? p.tag_kind}] {p.tag_label}
                </Link>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {p.best === null ? "아직 안 풀었어요" : `최고 ${p.best}%`} · {p.created_at.slice(5, 10)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
