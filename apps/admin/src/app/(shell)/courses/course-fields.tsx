"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type GroupOption = { id: string; name: string };

export type CourseFieldsValue = { title: string; description: string; groupIds: Set<string> };

/** 코스 이름·설명·연결 반 — 새 코스 시트와 코스 편집 화면이 같이 쓴다. */
export function CourseFields({
  value,
  onChange,
  groups,
}: {
  value: CourseFieldsValue;
  onChange: (v: CourseFieldsValue) => void;
  groups: GroupOption[];
}) {
  const toggle = (id: string) => {
    const next = new Set(value.groupIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...value, groupIds: next });
  };
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="course-title">코스 이름</Label>
        <Input
          id="course-title"
          value={value.title}
          maxLength={80}
          placeholder="예) 독서의 속도"
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="course-desc">설명 (선택)</Label>
        <Textarea
          id="course-desc"
          value={value.description}
          maxLength={500}
          rows={2}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>듣는 반</Label>
        {groups.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-xs">
            볼 수 있는 반이 없어요. [그룹(반)] 메뉴에서 먼저 만들어주세요.
          </p>
        ) : (
          <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
            {groups.map((g) => (
              <li key={g.id}>
                <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={value.groupIds.has(g.id)}
                    onChange={() => toggle(g.id)}
                    className="size-4 accent-current"
                  />
                  <span className="flex-1 text-sm font-medium">{g.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground text-xs">
          [수업 진행 처리]에서 이 반 학생이 기본으로 불려 와요. 한 반이 여러 코스를 들을 수 있어요.
        </p>
      </div>
    </div>
  );
}
