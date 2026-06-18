import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";

type Feedback = {
  overall_comment: string | null;
  better_than_yesterday: string | null;
  worse_than_yesterday: string | null;
  must_fix_tomorrow: string | null;
  publish_at: string;
};

type Props = {
  feedback: Feedback;
  journalDate: string;       // 이 리포트가 다루는 학생 일지 날짜 (어제)
  studentName?: string;       // 학부모 화면에서 자녀 이름 표기용
};

/**
 * 학생/학부모 대시보드 최상단 [오늘의 리포트] 카드.
 * `must_fix_tomorrow`는 가장 큰 헤딩으로 박힌다.
 */
export function TodayReportCard({ feedback, journalDate, studentName }: Props) {
  const dateLabel = new Date(journalDate).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <section className="border-primary/30 bg-primary/5 rounded-[16px] border-2 p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="text-primary inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
          <CalendarDays className="size-3.5" />
          오늘의 리포트
          {studentName && (
            <span className="text-foreground/70">· {studentName}</span>
          )}
        </p>
        <Link
          href="/dashboard/journal"
          className="text-muted-foreground inline-flex items-center text-xs hover:text-foreground"
        >
          지난 리포트
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">{dateLabel} 일지 피드백</p>

      {/* ★ 핵심 — 가장 큰 헤딩 */}
      {feedback.must_fix_tomorrow && (
        <div className="mt-5">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
            내일 반드시 고칠 것
          </p>
          <h2 className="font-display text-foreground mt-2 text-[28px] leading-tight md:text-[34px]">
            {feedback.must_fix_tomorrow}
          </h2>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {feedback.overall_comment && (
          <FeedbackBlock title="종합 코멘트" body={feedback.overall_comment} />
        )}
        {feedback.better_than_yesterday && (
          <FeedbackBlock
            title="어제보다 나아진 점"
            body={feedback.better_than_yesterday}
            tone="positive"
          />
        )}
        {feedback.worse_than_yesterday && (
          <FeedbackBlock
            title="어제보다 못한 점"
            body={feedback.worse_than_yesterday}
            tone="negative"
          />
        )}
      </div>
    </section>
  );
}

function FeedbackBlock({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="border-hairline rounded-[10px] border bg-background p-4">
      <p
        className={
          "text-xs font-bold uppercase tracking-wider " +
          (tone === "positive"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "negative"
              ? "text-primary"
              : "text-muted-foreground")
        }
      >
        {title}
      </p>
      <p className="text-foreground mt-2 whitespace-pre-wrap text-sm leading-relaxed">
        {body}
      </p>
    </div>
  );
}
