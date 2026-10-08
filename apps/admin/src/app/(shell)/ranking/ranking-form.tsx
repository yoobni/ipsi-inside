"use client";

import { useActionState } from "react";
import {
  RANKING_BOARD_KEYS,
  RANKING_BOARD_LABEL,
  RANKING_NAME_DISPLAY,
  RANKING_NAME_DISPLAY_LABEL,
  RANKING_SCOPE,
  RANKING_SCOPE_LABEL,
  TOP3_MIN,
  type RankingBoardKey,
} from "@ipsi/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateRankingSettingsAction } from "./actions";

export type RankingFormValues = {
  nameDisplay: "masked" | "full";
  scope: "all" | "group";
  show: Record<RankingBoardKey, boolean>;
  featuredTestSheetId: string | null;
};

const SHOW_FIELD: Record<RankingBoardKey, string> = {
  homework: "showHomework",
  attendance: "showAttendance",
  growth: "showGrowth",
  test: "showTest",
};

const BOARD_HINT: Record<RankingBoardKey, string> = {
  homework: `이번 주 (O+△)/도래 과제. 도래 ${TOP3_MIN.homework_due}개 이상인 학생만`,
  attendance: `최근 14일 출석률 60% + 과제 등급 40%. 마킹 ${TOP3_MIN.attendance_marked}일 이상`,
  growth: `일일 테스트 최근 14일 평균 − 그 전 14일 평균. 각 ${TOP3_MIN.growth_scores}회 이상`,
  test: `학생별 최고 응시 점수율. 제출자 ${TOP3_MIN.test_submitters}명 이상인 시험만`,
};

export function RankingForm({
  values,
  sheets,
}: {
  values: RankingFormValues;
  sheets: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateRankingSettingsAction, null);

  return (
    <form action={formAction} className="space-y-5 rounded-md border bg-card p-5">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state?.ok && (
        <Alert>
          <AlertDescription>저장했어요. 학생 화면에 바로 반영돼요.</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">이름 표시</legend>
        <p className="text-muted-foreground text-xs">
          본인 행은 항상 실명으로 보여요. 다른 학생 이름을 실명으로 보여주려면 처리방침의
          학습 성과 공개 항목을 확인하세요.
        </p>
        <div className="flex flex-wrap gap-4">
          {RANKING_NAME_DISPLAY.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="nameDisplay" value={v} defaultChecked={values.nameDisplay === v} />
              {RANKING_NAME_DISPLAY_LABEL[v]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">집계 범위</legend>
        <p className="text-muted-foreground text-xs">
          같은 그룹(반) 기준이면 학생이 속한 모든 비보관 그룹의 합집합이에요. 그룹이 없는 학생은
          학원 전체 기준으로 보여요.
        </p>
        <div className="flex flex-wrap gap-4">
          {RANKING_SCOPE.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="scope" value={v} defaultChecked={values.scope === v} />
              {RANKING_SCOPE_LABEL[v]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">보여줄 보드</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {RANKING_BOARD_KEYS.map((k) => (
            <li key={k}>
              <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5">
                <input type="checkbox" name={SHOW_FIELD[k]} defaultChecked={values.show[k]} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{RANKING_BOARD_LABEL[k]}</span>
                  <span className="text-muted-foreground block text-xs">{BOARD_HINT[k]}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="featuredTestSheetId">시험 우수 보드의 시험</Label>
        <select
          id="featuredTestSheetId"
          name="featuredTestSheetId"
          defaultValue={values.featuredTestSheetId ?? "__auto__"}
          className="focus-visible:ring-ring h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          <option value="__auto__">자동 — 제출자 3명 이상인 가장 최근 시험</option>
          {sheets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
