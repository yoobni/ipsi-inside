"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@ipsi/lib";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import {
  PASSAGE_SOURCE,
  passageWithQuestionsSchema,
  type PassageSource,
  type QuestionChoice,
} from "@ipsi/types";

type Result =
  | {
      ok: true;
      passageCount: number;
      questionCount: number;
      errors: string[];
    }
  | { ok: false; message: string };

/**
 * CSV로 지문/문항 일괄 등록.
 *
 * 컬럼 순서 (헤더 필수):
 *   passage_title, source_type, unit_major, unit_minor, passage_content,
 *   position, stem, supplementary, choice1, choice2, choice3, choice4, choice5,
 *   correct_answer, points, difficulty
 *
 * 같은 passage_title을 가진 행끼리 묶여 하나의 지문 + 문항들로 등록됨.
 * 지문 정보(content/unit_major 등)는 첫 행 값을 사용.
 */
export async function importPassagesCsvAction(
  _prev: unknown,
  fd: FormData,
): Promise<Result> {
  const file = fd.get("file");
  if (!(file instanceof File))
    return { ok: false, message: "CSV 파일이 없어요." };
  if (file.size > 5 * 1024 * 1024)
    return { ok: false, message: "5MB 이하의 파일만 업로드 가능합니다." };

  const text = await file.text();
  const records = parseCsv(text);
  if (records.length < 2)
    return { ok: false, message: "헤더 + 1행 이상이 필요해요." };

  const header = records[0]!.map((h) => h.trim());
  const required = [
    "passage_title",
    "source_type",
    "unit_major",
    "passage_content",
    "position",
    "stem",
    "correct_answer",
  ];
  for (const c of required) {
    if (!header.includes(c))
      return { ok: false, message: `필수 컬럼 누락: ${c}` };
  }
  const idx = (name: string) => header.indexOf(name);
  const at = (row: string[], name: string) =>
    idx(name) >= 0 ? (row[idx(name)] ?? "").trim() : "";

  // passage_title 그룹화
  type Bucket = {
    title: string;
    source_type: string;
    unit_major: string;
    unit_minor: string;
    content: string;
    rows: string[][];
  };
  const buckets = new Map<string, Bucket>();
  for (const row of records.slice(1)) {
    const title = at(row, "passage_title");
    if (!title) continue;
    const cur =
      buckets.get(title) ?? ({
        title,
        source_type: at(row, "source_type"),
        unit_major: at(row, "unit_major"),
        unit_minor: at(row, "unit_minor"),
        content: at(row, "passage_content"),
        rows: [] as string[][],
      } satisfies Bucket);
    // 지문 본문은 첫 행 값 사용 (빈 행은 무시)
    if (!cur.content && at(row, "passage_content"))
      cur.content = at(row, "passage_content");
    cur.rows.push(row);
    buckets.set(title, cur);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "인증 필요" };

  const errors: string[] = [];
  let passageCount = 0;
  let questionCount = 0;

  for (const b of buckets.values()) {
    if (!PASSAGE_SOURCE.includes(b.source_type as PassageSource)) {
      errors.push(
        `[${b.title}] source_type 값 오류: ${b.source_type} (허용: ${PASSAGE_SOURCE.join("/")})`,
      );
      continue;
    }

    const questions = b.rows.map((row) => {
      const choices: QuestionChoice[] = [1, 2, 3, 4, 5]
        .map((n) => ({ no: n, text: at(row, `choice${n}`) }))
        .filter((c) => c.text.length > 0)
        .map((c, i) => ({ no: i + 1, text: c.text }));
      const diff = at(row, "difficulty");
      return {
        position_in_passage: Number(at(row, "position")) || 1,
        stem: at(row, "stem"),
        supplementary: at(row, "supplementary") || null,
        choices,
        correct_answer: Number(at(row, "correct_answer")) || 1,
        points: Number(at(row, "points")) || 2,
        difficulty:
          diff === "상" || diff === "중" || diff === "하" ? diff : null,
        unit_minor: at(row, "unit_minor") || null,
      };
    });

    const parsed = passageWithQuestionsSchema.safeParse({
      passage: {
        title: b.title,
        source_type: b.source_type as PassageSource,
        content: b.content,
        unit_major: b.unit_major,
        unit_minor: b.unit_minor || null,
      },
      questions,
    });
    if (!parsed.success) {
      errors.push(
        `[${b.title}] ${parsed.error.issues[0]?.message ?? "검증 실패"}`,
      );
      continue;
    }

    const { data: passage, error: pErr } = await supabase
      .from("passages")
      .insert({
        title: parsed.data.passage.title,
        source_type: parsed.data.passage.source_type,
        content: parsed.data.passage.content,
        unit_major: parsed.data.passage.unit_major,
        unit_minor: parsed.data.passage.unit_minor ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (pErr || !passage) {
      errors.push(`[${b.title}] 지문 저장 실패: ${friendlyDbError(pErr)}`);
      continue;
    }

    const rows = parsed.data.questions.map((q) => ({
      passage_id: passage.id,
      position_in_passage: q.position_in_passage,
      stem: q.stem,
      supplementary: q.supplementary ?? null,
      choices: q.choices,
      correct_answer: q.correct_answer,
      points: q.points,
      difficulty: q.difficulty ?? null,
      unit_minor: q.unit_minor ?? null,
    }));

    const { error: qErr } = await supabase.from("questions").insert(rows);
    if (qErr) {
      await supabase.from("passages").delete().eq("id", passage.id);
      errors.push(`[${b.title}] 문항 저장 실패: ${friendlyDbError(qErr)}`);
      continue;
    }

    passageCount += 1;
    questionCount += rows.length;
  }

  revalidatePath("/passages");
  return { ok: true, passageCount, questionCount, errors };
}

/**
 * 간단 RFC4180 CSV 파서 — 빈 행 무시, 한 행은 string[].
 */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.some((v) => v.length > 0)) out.push(row);
        row = [];
      } else {
        cur += c;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.some((v) => v.length > 0)) out.push(row);
  }
  // strip BOM
  if (out.length > 0 && out[0]![0]!.charCodeAt(0) === 0xfeff) {
    out[0]![0] = out[0]![0]!.slice(1);
  }
  return out;
}
