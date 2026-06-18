"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  DIFFICULTY,
  PASSAGE_SOURCE,
  PASSAGE_SOURCE_LABEL,
  UNIT_MAJOR_PRESETS,
  type PassageInput,
  type PassageSource,
  type QuestionInput,
  type QuestionChoice,
} from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichEditor } from "@/components/rich-editor";
import { MobilePreview } from "@/components/mobile-preview";
import {
  createPassageWithQuestionsAction,
  deletePassageAction,
  updatePassageWithQuestionsAction,
} from "./actions";

const EMPTY_CHOICES: QuestionChoice[] = [1, 2, 3, 4, 5].map((no) => ({
  no,
  text: "",
}));

export function emptyQuestion(position: number): QuestionInput {
  return {
    position_in_passage: position,
    stem: "",
    supplementary: null,
    choices: EMPTY_CHOICES.map((c) => ({ ...c })),
    correct_answer: 1,
    points: 2,
    difficulty: null,
    unit_minor: null,
  };
}

type Mode =
  | { kind: "create" }
  | { kind: "edit"; passageId: string; usedCount: number };

export function PassageForm({
  mode,
  initialPassage,
  initialQuestions,
}: {
  mode: Mode;
  initialPassage?: PassageInput;
  initialQuestions?: QuestionInput[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  const [passage, setPassage] = useState<PassageInput>(
    initialPassage ?? {
      title: "",
      source_type: "reading" as PassageSource,
      content: "",
      unit_major: "",
      unit_minor: null,
    },
  );
  const [questions, setQuestions] = useState<QuestionInput[]>(
    initialQuestions && initialQuestions.length > 0
      ? initialQuestions
      : [emptyQuestion(1)],
  );

  const initialUnitIsPreset =
    !initialPassage ||
    UNIT_MAJOR_PRESETS.includes(
      initialPassage.unit_major as (typeof UNIT_MAJOR_PRESETS)[number],
    );
  const [unitMode, setUnitMode] = useState<"preset" | "custom">(
    initialUnitIsPreset ? "preset" : "custom",
  );

  const updatePassage = <K extends keyof PassageInput>(
    key: K,
    value: PassageInput[K],
  ) => setPassage((prev) => ({ ...prev, [key]: value }));

  const updateQuestion = (idx: number, patch: Partial<QuestionInput>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  };

  const updateChoice = (qIdx: number, choiceNo: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              choices: q.choices.map((c) =>
                c.no === choiceNo ? { ...c, text } : c,
              ),
            }
          : q,
      ),
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      emptyQuestion(
        prev.length > 0
          ? Math.max(...prev.map((q) => q.position_in_passage)) + 1
          : 1,
      ),
    ]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length === 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const previewQuestions = useMemo(() => questions, [questions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passage.title.trim()) return setError("지문 제목을 입력해주세요");
    if (!passage.unit_major.trim()) return setError("대단원을 입력해주세요");
    if (!passage.content) return setError("지문 본문을 입력해주세요");

    for (const q of questions) {
      if (!q.stem)
        return setError(`문항 ${q.position_in_passage}: 문제 본문 비어있음`);
      const filled = q.choices.filter((c) => c.text.trim()).length;
      if (filled < 2)
        return setError(`문항 ${q.position_in_passage}: 선지 최소 2개 입력`);
      if (q.correct_answer > q.choices.length || q.correct_answer < 1)
        return setError(`문항 ${q.position_in_passage}: 정답 범위 오류`);
    }

    const cleanedQuestions = questions.map((q) => {
      const filled = q.choices.filter((c) => c.text.trim());
      return {
        ...q,
        choices: filled.map((c, i) => ({ no: i + 1, text: c.text })),
        unit_minor: q.unit_minor?.toString().trim() || null,
      };
    });

    const payload = {
      passage: {
        ...passage,
        unit_minor: passage.unit_minor?.toString().trim() || null,
      },
      questions: cleanedQuestions,
    };

    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));

    startTransition(async () => {
      const r =
        mode.kind === "edit"
          ? await updatePassageWithQuestionsAction(mode.passageId, null, fd)
          : await createPassageWithQuestionsAction(null, fd);
      if (r.ok) router.push("/passages");
      else setError(r.message);
    });
  };

  const handleDelete = () => {
    if (mode.kind !== "edit") return;
    if (!confirm("이 지문을 삭제할까요? 시험지에 사용 중이면 거부돼요.")) return;
    setError(null);
    startDeleteTransition(async () => {
      const r = await deletePassageAction(mode.passageId);
      if (r.ok) router.push("/passages");
      else setError(r.message);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 지문 메타 */}
        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">지문 정보</h2>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">지문 제목 *</Label>
              <Input
                id="title"
                value={passage.title}
                onChange={(e) => updatePassage("title", e.target.value)}
                placeholder="예) 2024학년도 9월 모평 비문학 (인문 17~20)"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">분류 *</Label>
              <Select
                value={passage.source_type}
                onValueChange={(v) =>
                  updatePassage("source_type", v as PassageSource)
                }
              >
                <SelectTrigger id="source" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PASSAGE_SOURCE.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PASSAGE_SOURCE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-major">대단원 *</Label>
              <div className="flex gap-2">
                {unitMode === "preset" ? (
                  <Select
                    value={
                      UNIT_MAJOR_PRESETS.includes(
                        passage.unit_major as (typeof UNIT_MAJOR_PRESETS)[number],
                      )
                        ? passage.unit_major
                        : undefined
                    }
                    onValueChange={(v) => updatePassage("unit_major", v)}
                  >
                    <SelectTrigger id="unit-major" className="flex-1">
                      <SelectValue placeholder="대단원 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_MAJOR_PRESETS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="unit-major"
                    value={passage.unit_major}
                    onChange={(e) => updatePassage("unit_major", e.target.value)}
                    placeholder="직접 입력"
                    className="flex-1"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setUnitMode((m) => (m === "preset" ? "custom" : "preset"))
                  }
                  className="shrink-0"
                >
                  {unitMode === "preset" ? "직접 입력" : "프리셋"}
                </Button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="unit-minor">소단원 (선택)</Label>
              <Input
                id="unit-minor"
                value={passage.unit_minor ?? ""}
                onChange={(e) => updatePassage("unit_minor", e.target.value)}
                placeholder="예) 인식론, 현대시-김소월"
              />
            </div>
          </div>
        </section>

        {/* 지문 본문 */}
        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">지문 본문 *</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              한자/표/이미지/줄바꿈 모두 가능. 우측 미리보기에서 학생 화면 그대로 확인.
            </p>
          </div>
          <div className="p-4">
            <RichEditor
              value={passage.content}
              onChange={(v) => updatePassage("content", v)}
              placeholder="지문 본문을 입력하세요..."
            />
          </div>
        </section>

        {/* 문항들 */}
        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">
                문항 ({questions.length}문항)
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                지문 안에 딸린 문항을 순서대로 등록.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addQuestion}>
              <Plus className="size-4" /> 문항 추가
            </Button>
          </div>
          <div className="space-y-4 p-4">
            {questions.map((q, idx) => (
              <QuestionEditor
                key={idx}
                question={q}
                canRemove={questions.length > 1}
                onChange={(patch) => updateQuestion(idx, patch)}
                onChoiceChange={(choiceNo, text) =>
                  updateChoice(idx, choiceNo, text)
                }
                onRemove={() => removeQuestion(idx)}
              />
            ))}
          </div>
        </section>

        <div className="flex justify-between gap-2">
          {mode.kind === "edit" ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={pending || deletePending || mode.usedCount > 0}
              title={
                mode.usedCount > 0
                  ? "시험지에 사용 중이라 삭제 불가"
                  : "지문 삭제"
              }
            >
              <Trash2 className="text-destructive size-4" />
              {deletePending ? "삭제 중..." : "지문 삭제"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button asChild variant="outline" type="button">
              <a href="/passages">취소</a>
            </Button>
            <Button type="submit" disabled={pending || deletePending}>
              {pending
                ? "저장 중..."
                : mode.kind === "edit"
                  ? "변경 저장"
                  : "지문 등록"}
            </Button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <MobilePreview passage={passage} questions={previewQuestions} />
      </div>
    </form>
  );
}

function QuestionEditor({
  question,
  canRemove,
  onChange,
  onChoiceChange,
  onRemove,
}: {
  question: QuestionInput;
  canRemove: boolean;
  onChange: (patch: Partial<QuestionInput>) => void;
  onChoiceChange: (choiceNo: number, text: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
          {question.position_in_passage}
        </span>
        <span className="text-sm font-semibold">번 문항</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">정답</span>
            <Select
              value={String(question.correct_answer)}
              onValueChange={(v) => onChange({ correct_answer: Number(v) })}
            >
              <SelectTrigger size="sm" className="w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {["", "①", "②", "③", "④", "⑤"][n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">배점</span>
            <Input
              type="number"
              min={1}
              max={10}
              value={question.points}
              onChange={(e) =>
                onChange({ points: Number(e.target.value) || 1 })
              }
              className="w-16"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">난이도</span>
            <Select
              value={question.difficulty ?? "_none"}
              onValueChange={(v) =>
                onChange({
                  difficulty:
                    v === "_none" ? null : (v as "상" | "중" | "하"),
                })
              }
            >
              <SelectTrigger size="sm" className="w-[72px]">
                <SelectValue placeholder="-" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">-</SelectItem>
                {DIFFICULTY.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={!canRemove}
            onClick={onRemove}
            aria-label="문항 삭제"
            className="size-8"
          >
            <Trash2 className="text-destructive size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">문제 본문 *</Label>
          <RichEditor
            size="small"
            value={question.stem}
            onChange={(v) => onChange({ stem: v })}
            placeholder="예) 윗글의 내용과 일치하지 않는 것은?"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">〈보기〉 (선택)</Label>
          <RichEditor
            size="small"
            value={question.supplementary ?? ""}
            onChange={(v) => onChange({ supplementary: v || null })}
            placeholder="〈보기〉 자료가 필요한 문항이면 입력"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">선지 (5지선다, 빈칸이면 무시)</Label>
          <div className="space-y-2">
            {question.choices.map((c) => (
              <div key={c.no} className="flex items-start gap-2">
                <span
                  className={`mt-1.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums ${
                    question.correct_answer === c.no
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-muted-foreground"
                  }`}
                  title={
                    question.correct_answer === c.no ? "정답" : `선지 ${c.no}`
                  }
                >
                  {["", "①", "②", "③", "④", "⑤"][c.no]}
                </span>
                <div className="flex-1">
                  <RichEditor
                    size="small"
                    value={c.text}
                    onChange={(v) => onChoiceChange(c.no, v)}
                    placeholder={`선지 ${c.no}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
