import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnswerPanel } from "../answer-panel";

export const dynamic = "force-dynamic";

export default async function QnaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: q } = await supabase
    .from("qna_questions")
    .select("id, student_id, category_id, reference_label, question_no, body, image_path, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!q) notFound();

  const [{ data: student }, { data: cat }, { data: answer }] = await Promise.all([
    supabase.from("profiles").select("full_name, school, grade").eq("id", q.student_id).maybeSingle(),
    q.category_id
      ? supabase.from("qna_categories").select("label").eq("id", q.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("qna_answers").select("body, published_at").eq("question_id", id).maybeSingle(),
  ]);

  // 첨부 사진 signed URL (admin은 전체 select 권한)
  let imageUrl: string | null = null;
  if (q.image_path) {
    const { data: signed } = await createAdminSupabaseClient()
      .storage.from("qna-images")
      .createSignedUrl(q.image_path, 300);
    imageUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/qna">
          <ChevronLeft className="size-4" />
          목록
        </Link>
      </Button>

      <div className="space-y-3 rounded-md border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{student?.full_name ?? "학생"}</span>
          <span className="text-muted-foreground text-xs">
            {student?.school ?? ""}{student?.grade ? ` ${student.grade}학년` : ""}
          </span>
          {cat?.label && <Badge variant="primary">{cat.label}</Badge>}
          {q.reference_label && (
            <span className="text-muted-foreground text-xs">
              {q.reference_label}{q.question_no ? ` · ${q.question_no}` : ""}
            </span>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap">{q.body}</p>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="질문 첨부 사진"
            className="max-h-96 rounded-md border"
          />
        )}
      </div>

      <div className="rounded-md border bg-card p-5">
        <AnswerPanel
          questionId={q.id}
          initialBody={answer?.body ?? ""}
          published={!!answer?.published_at}
        />
      </div>
    </div>
  );
}
