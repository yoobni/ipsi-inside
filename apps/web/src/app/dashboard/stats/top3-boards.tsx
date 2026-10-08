import { Trophy } from "lucide-react";
import type { Top3Board, Top3Boards } from "@ipsi/types";
import { cn } from "@/lib/utils";

const MEDAL = ["🥇", "🥈", "🥉"];

/**
 * TOP3 보드들. 긍정적 자극만 — 상위 3명과 내 값만 보이고 내 순위는 없다.
 * 내가 들어 있으면 그 행을 강조한다.
 */
export function Top3Boards({ data, viewerIsStudent }: { data: Top3Boards; viewerIsStudent: boolean }) {
  if (data.boards.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold">
          <Trophy className="text-primary size-4" />
          이번 주 TOP3
        </h2>
        <span className="text-muted-foreground text-[11px]">{data.settings.scope_label}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.boards.map((b) => (
          <BoardCard key={b.key} board={b} viewerIsStudent={viewerIsStudent} />
        ))}
      </div>
    </section>
  );
}

function BoardCard({ board, viewerIsStudent }: { board: Top3Board; viewerIsStudent: boolean }) {
  const meInTop = board.entries.some((e) => e.is_me);
  return (
    <div className="border-hairline bg-surface rounded-[14px] border p-4">
      <p className="text-sm font-bold">{board.title}</p>
      <p className="text-muted-foreground mt-0.5 text-[11px]">{board.period_label}</p>

      {board.entries.length === 0 ? (
        <p className="text-muted-foreground mt-3 rounded-md border border-dashed px-3 py-4 text-center text-xs">
          {board.subtitle ?? "아직 집계된 기록이 없어요"}
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {board.entries.map((e, i) => (
            <li
              key={`${e.rank}-${e.name}-${i}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm",
                e.is_me ? "border-primary bg-primary/5" : "border-hairline",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span aria-label={`${e.rank}위`}>{MEDAL[e.rank - 1] ?? `${e.rank}위`}</span>
                <span className={cn("truncate", e.is_me && "font-bold")}>{e.name}</span>
                {e.is_me && (
                  <span className="bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-[10px] font-bold">
                    {viewerIsStudent ? "나" : "자녀"}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{e.value_label}</span>
            </li>
          ))}
        </ol>
      )}

      {/* 내 값 — 순위는 보여주지 않는다 */}
      {!meInTop && board.me && (
        <p className="text-muted-foreground mt-2 text-[11px]">
          {board.me.qualified
            ? `${viewerIsStudent ? "나" : "자녀"}: ${board.me.value_label}${board.entries.length > 0 ? " · 조금만 더!" : ""}`
            : `${viewerIsStudent ? "나" : "자녀"}는 아직 집계 조건이 안 됐어요`}
        </p>
      )}
    </div>
  );
}
