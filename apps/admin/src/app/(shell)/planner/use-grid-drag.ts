"use client";

import { useCallback, useRef, useState } from "react";
import { findPlannerOverlap, type PlannerBlockInput } from "@ipsi/types";

/**
 * 타임테이블 격자의 드래그 — 생성 / 이동 / 길이조절.
 *
 * 격자는 이미 `top = ((min - START_MIN) / 60) * HOUR_PX` 로 그려진다.
 * 여기서는 그 역함수(픽셀 → 분)와 포인터 상태만 담당하고, 실제 저장은
 * 호출부(planner-client)가 한다.
 *
 * 마우스와 터치를 나눠 다룬다:
 *   - 마우스: 빈 칸을 쓸면 생성, 블록 본체를 끌면 이동, 아래끝을 끌면 길이조절
 *   - 터치: 본체 드래그를 그대로 열면 격자 스크롤과 충돌한다. 그래서 터치는
 *     탭으로 블록을 고른 뒤 **핸들에서만** 끌게 한다(핸들에 touch-action:none).
 *     long-press 방식은 스크롤 시작과 구분이 애매해 채택하지 않았다.
 */

/** 격자 시간 범위 — 06:00~24:00 고정.
 *
 * 예전엔 "가장 이른 블록 - 1시간"으로 자동이었는데, 드래그를 붙이면 그 자동
 * 범위가 곧 "만들 수 있는 시간의 한계"가 된다(19시 블록만 있으면 18시 이전에
 * 블록을 못 만든다). DB 제약이 start_min ∈ [0,1440) 이라 24시를 넘길 수는 없다.
 */
export const GRID_START_HOUR = 6;
export const GRID_END_HOUR = 24;
export const GRID_START_MIN = GRID_START_HOUR * 60;
export const GRID_END_MIN = GRID_END_HOUR * 60;
export const HOUR_PX = 44;
export const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;

/** 시간 입력(step=300)과 같은 5분 단위 */
const SNAP_MIN = 5;
/**
 * 드래그로 만들 수 있는 가장 늦은 종료 시각 — 23:55.
 *
 * DB는 end_min = 1440(24:00)까지 허용하지만, 편집 시트의 <input type="time">은
 * 24:00을 표현하지 못한다. 드래그로 24:00 블록을 만들면 그 블록을 열었을 때
 * 종료 칸이 빈 채로 뜨고 "시각 형식이 올바르지 않아요"로 막힌다.
 * 격자는 24:00까지 그리되, 값은 시트가 되받을 수 있는 범위로 자른다.
 */
export const MAX_BLOCK_END_MIN = 23 * 60 + 55;
/** 길이조절 최소 — 이보다 짧으면 글자가 안 보인다 */
const MIN_BLOCK_MIN = 15;
/** 이만큼 움직이기 전엔 클릭으로 본다 */
const DRAG_THRESHOLD_PX = 4;

export function minToY(min: number): number {
  return ((min - GRID_START_MIN) / 60) * HOUR_PX;
}

function snap(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}

export function yToMin(y: number): number {
  const raw = GRID_START_MIN + (y / HOUR_PX) * 60;
  return Math.min(GRID_END_MIN, Math.max(GRID_START_MIN, snap(raw)));
}

export type DragKind = "create" | "move" | "resize";

export type DragState = {
  kind: DragKind;
  /** move/resize 대상 블록의 blocks 배열 인덱스 */
  index?: number;
  day: number;
  start_min: number;
  end_min: number;
  /** 겹쳐서 놓을 수 없는 상태 */
  invalid: boolean;
};

type Anchor = {
  kind: DragKind;
  index?: number;
  /** create: 쓸기 시작한 분 / move: 잡은 지점과 블록 시작의 차이 */
  originMin: number;
  originDay: number;
  /** move에서 길이를 유지하기 위해 */
  durationMin: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
};

export function useGridDrag({
  blocks,
  gridRef,
  onCreate,
  onCommit,
  onPick,
}: {
  blocks: PlannerBlockInput[];
  /** 7개 요일 열을 감싸는 요소 — 좌표 계산 기준 */
  gridRef: React.RefObject<HTMLDivElement | null>;
  /** 빈 칸을 쓸거나 눌렀을 때 — 시트를 이 범위로 미리 채워 연다 */
  onCreate: (day: number, startMin: number, endMin: number) => void;
  /** 이동·길이조절을 놓았을 때 — 저장 */
  onCommit: (index: number, day: number, startMin: number, endMin: number) => void;
  /** 블록을 끌지 않고 눌렀다 뗐을 때 — 편집 시트 */
  onPick: (index: number) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const anchorRef = useRef<Anchor | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const setBoth = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  /** 포인터 좌표 → (요일, 분). 열 폭이 1fr이라 실측한다. */
  const locate = useCallback(
    (clientX: number, clientY: number) => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const colWidth = rect.width / 7;
      const day = Math.min(
        6,
        Math.max(0, Math.floor((clientX - rect.left) / colWidth)),
      );
      return { day, min: yToMin(clientY - rect.top) };
    },
    [gridRef],
  );

  const isInvalid = useCallback(
    (index: number | undefined, day: number, s: number, e: number) => {
      const candidate = [
        ...blocks.map((b) => ({
          day_of_week: b.day_of_week,
          start_min: b.start_min,
          end_min: b.end_min,
        })),
        { day_of_week: day, start_min: s, end_min: e },
      ];
      // 이동 중인 블록 자신은 겹침 판정에서 뺀다
      return findPlannerOverlap(candidate, index) !== null;
    },
    [blocks],
  );

  const begin = useCallback(
    (
      e: React.PointerEvent,
      kind: DragKind,
      index?: number,
    ) => {
      // 터치는 핸들에서만 시작한다(호출부가 보장). 마우스 우클릭은 무시.
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const at = locate(e.clientX, e.clientY);
      if (!at) return;

      const block = index !== undefined ? blocks[index] : undefined;
      const duration = block ? block.end_min - block.start_min : 0;

      anchorRef.current = {
        kind,
        index,
        // move: 블록 안 어디를 잡았는지 기억해야 끌 때 튀지 않는다
        originMin: kind === "move" && block ? at.min - block.start_min : at.min,
        originDay: at.day,
        durationMin: duration,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        moved: false,
      };

      // 포인터를 잡아두지 않으면 격자 밖으로 나갔을 때 move가 끊긴다
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.stopPropagation();
      e.preventDefault();
    },
    [blocks, locate],
  );

  const move = useCallback(
    (e: React.PointerEvent) => {
      const a = anchorRef.current;
      if (!a || a.pointerId !== e.pointerId) return;

      if (!a.moved) {
        const dx = Math.abs(e.clientX - a.startClientX);
        const dy = Math.abs(e.clientY - a.startClientY);
        if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;
        a.moved = true;
      }

      const at = locate(e.clientX, e.clientY);
      if (!at) return;

      let day = a.originDay;
      let s: number;
      let en: number;

      if (a.kind === "create") {
        day = at.day;
        s = Math.min(a.originMin, at.min);
        en = Math.max(a.originMin, at.min);
        if (en - s < MIN_BLOCK_MIN) en = s + MIN_BLOCK_MIN;
        en = Math.min(en, MAX_BLOCK_END_MIN);
        s = Math.min(s, en - MIN_BLOCK_MIN);
      } else if (a.kind === "move") {
        day = at.day;
        s = at.min - a.originMin;
        // 격자 밖으로 밀려나지 않게 양끝에서 잡아둔다
        s = Math.max(
          GRID_START_MIN,
          Math.min(s, MAX_BLOCK_END_MIN - a.durationMin),
        );
        en = s + a.durationMin;
      } else {
        const block = a.index !== undefined ? blocks[a.index] : undefined;
        if (!block) return;
        day = block.day_of_week;
        s = block.start_min;
        en = Math.max(at.min, s + MIN_BLOCK_MIN);
        en = Math.min(en, MAX_BLOCK_END_MIN);
      }

      setBoth({
        kind: a.kind,
        index: a.index,
        day,
        start_min: s,
        end_min: en,
        invalid: isInvalid(a.index, day, s, en),
      });
    },
    [blocks, isInvalid, locate],
  );

  const end = useCallback(
    (e: React.PointerEvent) => {
      const a = anchorRef.current;
      const d = dragRef.current;
      anchorRef.current = null;
      setBoth(null);
      if (!a || a.pointerId !== e.pointerId) return;

      // 움직이지 않았으면 클릭이다
      if (!a.moved) {
        if (a.kind === "create") {
          const startMin = Math.min(a.originMin, MAX_BLOCK_END_MIN - 120);
          onCreate(a.originDay, startMin, startMin + 120);
        } else if (a.index !== undefined) {
          onPick(a.index);
        }
        return;
      }

      if (!d) return;
      // 겹친 채로 놓으면 저장하지 않는다 — 서버가 어차피 거부하고,
      // 되돌리는 것보다 아예 안 옮기는 쪽이 원장에게 덜 혼란스럽다
      if (d.invalid) return;

      if (d.kind === "create") {
        onCreate(d.day, d.start_min, d.end_min);
      } else if (d.index !== undefined) {
        const b = blocks[d.index];
        // 실제로 바뀐 게 없으면 저장 왕복을 하지 않는다
        if (
          b &&
          b.day_of_week === d.day &&
          b.start_min === d.start_min &&
          b.end_min === d.end_min
        ) {
          return;
        }
        onCommit(d.index, d.day, d.start_min, d.end_min);
      }
    },
    [blocks, onCommit, onCreate, onPick],
  );

  const cancel = useCallback(() => {
    anchorRef.current = null;
    setBoth(null);
  }, []);

  return { drag, begin, move, end, cancel };
}
