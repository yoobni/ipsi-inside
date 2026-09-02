"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { importPassagesCsvAction } from "./actions";

type ResultMsg =
  | { kind: "ok"; passageCount: number; questionCount: number; errors: string[] }
  | { kind: "err"; message: string };

export function ImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResultMsg | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setResult({ kind: "err", message: "파일을 선택해주세요." });
      return;
    }
    setResult(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const r = await importPassagesCsvAction(null, fd);
      if (r.ok) {
        setResult({
          kind: "ok",
          passageCount: r.passageCount,
          questionCount: r.questionCount,
          errors: r.errors,
        });
        setFile(null);
        const input = document.getElementById("csv-input") as HTMLInputElement | null;
        if (input) input.value = "";
      } else {
        setResult({ kind: "err", message: r.message });
      }
    });
  };

  return (
    <>
      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">CSV 형식</h2>
        </div>
        <div className="space-y-2 p-4 text-xs">
          <p className="text-muted-foreground">
            첫 줄은 컬럼 헤더. 같은{" "}
            <code className="bg-muted rounded px-1">passage_title</code> 값을 가진
            행들이 하나의 지문으로 묶이고, 각 행이 그 지문의 문항이 돼요.
          </p>
          <p className="text-muted-foreground">필수 컬럼:</p>
          <pre className="bg-muted overflow-x-auto rounded p-3 text-[11px]">
{`passage_title,source_type,unit_major,unit_minor,passage_content,position,stem,supplementary,choice1,choice2,choice3,choice4,choice5,correct_answer,points,difficulty`}
          </pre>
          <ul className="text-muted-foreground list-disc space-y-0.5 pl-5">
            <li>
              <code>source_type</code>: <code>reading</code> / <code>literature</code>{" "}
              / <code>speech_writing</code> / <code>language_media</code>
            </li>
            <li>
              <code>position</code>: 지문 내 문항 번호 (1, 2, 3...)
            </li>
            <li>
              <code>correct_answer</code>: 1~5
            </li>
            <li>
              <code>points</code>: 1~10 (생략 시 2)
            </li>
            <li>
              <code>difficulty</code>: 상/중/하 (선택)
            </li>
            <li>같은 지문의 두 번째 행부터는 passage_content/unit_major 비워도 됨</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            예시 (가운데 줄임):
          </p>
          <pre className="bg-muted overflow-x-auto rounded p-3 text-[11px]">
{`passage_title,source_type,unit_major,...,position,stem,...,correct_answer,points,difficulty
"6월 모평 17~20",reading,독서-인문,,"...본문...",1,"내용 일치는?",,...3,2,중
"6월 모평 17~20",,,,,,2,"보기 추론은?",,...4,3,상`}
          </pre>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-md border bg-card space-y-4 p-4"
      >
        <div className="border-input flex items-center gap-3 rounded-md border border-dashed bg-background p-4">
          <FileUp className="text-muted-foreground size-5" />
          <input
            id="csv-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="flex-1 text-sm"
          />
        </div>

        {result?.kind === "err" && (
          <Alert variant="destructive">
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}
        {result?.kind === "ok" && (
          <Alert>
            <AlertDescription>
              <p>
                <CheckCircle2 className="inline size-4 text-emerald-600" />{" "}
                지문 <strong>{result.passageCount}</strong>개 ·{" "}
                문항 <strong>{result.questionCount}</strong>개 등록됨.
              </p>
              {result.errors.length > 0 && (
                <>
                  <p className="mt-2 font-semibold">실패한 항목:</p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !file}>
            <Upload className="size-4" />
            {pending ? "처리 중..." : "업로드"}
          </Button>
        </div>
      </form>
    </>
  );
}
