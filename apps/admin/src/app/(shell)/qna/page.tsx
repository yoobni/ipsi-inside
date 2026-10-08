import Link from "next/link";
import { Settings, Star } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Filter = "all" | "open" | "answered" | "starred";

type QuestionRow = {
  id: string;
  student_id: string;
  category_id: string | null;
  reference_label: string | null;
  question_no: string | null;
  body: string;
  status: string;
  created_at: string;
  starred: boolean;
};

export default async function QnaAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter: Filter =
    sp.filter === "answered" || sp.filter === "open" || sp.filter === "starred"
      ? sp.filter
      : "all";
  const supabase = await createServerSupabaseClient();

  // 좋은 질문은 별도 테이블 — 행마다 ★ 표시는 임베드로, '좋은 질문' 탭은 inner join으로.
  // (id 목록을 .in()으로 넘기면 선정이 수백 개 쌓였을 때 URL이 터진다)
  const starEmbed = filter === "starred" ? "qna_question_stars!inner(question_id)" : "qna_question_stars(question_id)";
  let query = supabase
    .from("qna_questions")
    .select(
      `id, student_id, category_id, reference_label, question_no, body, status, created_at, ${starEmbed}`,
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter === "open" || filter === "answered") query = query.eq("status", filter);
  const [{ data }, { count: starredCount }] = await Promise.all([
    query,
    supabase.from("qna_question_stars").select("question_id", { count: "exact", head: true }),
  ]);
  const questions: QuestionRow[] = (data ?? []).map((q) => ({
    id: q.id,
    student_id: q.student_id,
    category_id: q.category_id,
    reference_label: q.reference_label,
    question_no: q.question_no,
    body: q.body,
    status: q.status,
    created_at: q.created_at,
    // 1:1 임베드는 객체 또는 null, 혹시 배열로 와도 처리
    starred: Array.isArray(q.qna_question_stars)
      ? q.qna_question_stars.length > 0
      : q.qna_question_stars != null,
  }));
  const starredIds = { length: starredCount ?? 0 };

  const studentIds = [...new Set(questions.map((q) => q.student_id))];
  const catIds = [...new Set(questions.map((q) => q.category_id).filter(Boolean))] as string[];
  const [{ data: students }, { data: cats }] = await Promise.all([
    studentIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", studentIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    catIds.length
      ? supabase.from("qna_categories").select("id, label").in("id", catIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
  ]);
  const nameOf = new Map((students ?? []).map((s) => [s.id, s.full_name] as const));
  const catOf = new Map((cats ?? []).map((c) => [c.id, c.label] as const));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Q&amp;A</h1>
          <p className="text-muted-foreground text-sm">
            학생 질문에 답변해요. 답변은 발행해야 학생에게 보여요.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/qna/settings">
            <Settings className="size-4" />
            분류·가이드
          </Link>
        </Button>
      </div>

      <div className="flex gap-1.5">
        {[
          { k: "all", label: "전체" },
          { k: "open", label: "답변 대기" },
          { k: "answered", label: "답변 완료" },
          { k: "starred", label: `좋은 질문 ${starredIds.length}` },
        ].map((f) => (
          <Button
            key={f.k}
            asChild
            size="sm"
            variant={filter === f.k ? "default" : "outline"}
          >
            <Link href={f.k === "all" ? "/qna" : `/qna?filter=${f.k}`}>{f.label}</Link>
          </Button>
        ))}
      </div>

      {questions.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed py-16 text-center text-sm">
          {filter === "starred"
            ? "아직 선정한 좋은 질문이 없어요. 질문 상세에서 ★로 선정해요."
            : "해당하는 질문이 없어요."}
        </div>
      ) : (
        <ul className="space-y-2">
          {questions.map((q) => (
            <li key={q.id}>
              <Link
                href={`/qna/${q.id}`}
                className="hover:border-primary/40 block rounded-md border bg-card px-4 py-3 transition-colors"
              >
                <div className="mb-1 flex items-center gap-2">
                  {q.starred && (
                    <Star
                      className="size-3.5 fill-amber-400 text-amber-400"
                      aria-label="좋은 질문"
                    />
                  )}
                  <span className="font-medium">{nameOf.get(q.student_id) ?? "학생"}</span>
                  {q.category_id && catOf.get(q.category_id) && (
                    <Badge variant="primary">{catOf.get(q.category_id)}</Badge>
                  )}
                  {q.reference_label && (
                    <span className="text-muted-foreground text-xs">
                      {q.reference_label}
                      {q.question_no ? ` · ${q.question_no}` : ""}
                    </span>
                  )}
                  {q.status === "answered" ? (
                    <Badge variant="success">답변 완료</Badge>
                  ) : (
                    <Badge variant="warning">대기</Badge>
                  )}
                </div>
                <p className="text-muted-foreground line-clamp-2 text-sm">{q.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
