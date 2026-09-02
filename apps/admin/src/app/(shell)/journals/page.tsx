import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { JournalsTable } from "./journals-table";

export const dynamic = "force-dynamic";

export default async function JournalsPage() {
  const supabase = await createServerSupabaseClient();

  // 최근 30일 이내 일지 (피드백 유무 포함)
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data: journals } = await supabase
    .from("study_journals")
    .select(
      "id, student_id, journal_date, content, class_question, test_question, message_to_teacher, learning_log, submitted_at, updated_at",
    )
    .gte("journal_date", sinceDate)
    .order("journal_date", { ascending: false })
    .order("submitted_at", { ascending: false });

  const studentIds = Array.from(
    new Set((journals ?? []).map((j) => j.student_id)),
  );
  const { data: students } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, school, grade")
          .in("id", studentIds)
      : { data: [] };

  const journalIds = (journals ?? []).map((j) => j.id);
  const { data: feedbacks } =
    journalIds.length > 0
      ? await supabase
          .from("journal_feedbacks")
          .select(
            "journal_id, overall_comment, better_than_yesterday, worse_than_yesterday, must_fix_tomorrow, publish_at, updated_at",
          )
          .in("journal_id", journalIds)
      : { data: [] };

  const studentMap = new Map(
    (students ?? []).map((s) => [s.id, s] as const),
  );
  const feedbackMap = new Map(
    (feedbacks ?? []).map((f) => [f.journal_id, f] as const),
  );

  const rows = (journals ?? []).map((j) => ({
    journal: j,
    student: studentMap.get(j.student_id),
    feedback: feedbackMap.get(j.id),
  }));

  const unansweredCount = rows.filter((r) => !r.feedback).length;
  const draftCount = rows.filter((r) => r.feedback && !r.feedback.publish_at).length;
  const publishedCount = rows.filter(
    (r) => r.feedback && r.feedback.publish_at,
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">학습 일지</h1>
        <p className="text-muted-foreground text-sm">
          학생이 제출한 일일 일지를 검수하고 4필드 피드백을 작성·발행해요. 발행하면 즉시 학생/학부모에게 노출돼요.
        </p>
      </div>

      <JournalsTable
        rows={rows}
        unansweredCount={unansweredCount}
        draftCount={draftCount}
        publishedCount={publishedCount}
      />
    </div>
  );
}
