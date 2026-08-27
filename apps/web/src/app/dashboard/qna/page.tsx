import { redirect } from "next/navigation";
import { MessageCircleQuestion } from "lucide-react";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { readAuthState } from "@/lib/auth-state";
import { getMyNotifications, type NotificationItem } from "@/lib/notifications";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNav } from "@/components/dashboard-nav";
import { Wordmark } from "@/components/wordmark";
import { AskForm, type Category } from "./ask-form";
import { QuestionList, type QuestionItem } from "./question-list";

export const dynamic = "force-dynamic";

export default async function QnaPage() {
  const supabase = await createServerSupabaseClient();
  const state = await readAuthState(supabase);
  if (state.kind === "guest") redirect("/login");
  if (state.kind === "ok" && state.status !== "approved") redirect("/pending");
  if (state.kind !== "ok") return null;

  const notif = await getMyNotifications(supabase, state.userId);

  const { data: catRows } = await supabase
    .from("qna_categories")
    .select("id, label, placeholder, needs_reference")
    .eq("archived", false)
    .order("position");
  const categories: Category[] = catRows ?? [];
  const catLabel = new Map(categories.map((c) => [c.id, c.label] as const));

  // 학생은 본인 질문만(RLS). 학부모는 Q&A 대상 아님 — 빈 목록.
  const { data: questions } =
    state.role === "student"
      ? await supabase
          .from("qna_questions")
          .select(
            "id, category_id, reference_label, question_no, body, image_path, status, created_at",
          )
          .order("created_at", { ascending: false })
      : { data: [] };

  const qIds = (questions ?? []).map((q) => q.id);
  const { data: answers } =
    qIds.length > 0
      ? await supabase
          .from("qna_answers")
          .select("question_id, body, published_at")
          .in("question_id", qIds)
      : { data: [] };
  const answerOf = new Map(
    (answers ?? []).map((a) => [a.question_id, a] as const),
  );

  const items: QuestionItem[] = (questions ?? []).map((q) => {
    const a = answerOf.get(q.id);
    return {
      id: q.id,
      categoryLabel: q.category_id ? (catLabel.get(q.category_id) ?? null) : null,
      referenceLabel: q.reference_label,
      questionNo: q.question_no,
      body: q.body,
      hasImage: !!q.image_path,
      status: q.status as "open" | "answered",
      createdAt: q.created_at,
      answer: a ? { body: a.body, publishedAt: a.published_at } : null,
    };
  });

  return (
    <Shell notifItems={notif.items} unreadCount={notif.unreadCount}>
      <div className="space-y-1">
        <h1 className="font-display text-[34px] leading-tight">Q&amp;A</h1>
        <p className="text-muted-foreground text-sm">
          수업·교재 문제에서 막힌 점을 바로 물어보세요. 원장님이 확인 후 답변을
          드려요.
        </p>
      </div>

      {state.role === "student" ? (
        <>
          {categories.length > 0 ? (
            <AskForm categories={categories} />
          ) : (
            <p className="text-muted-foreground text-sm">
              아직 질문 분류가 준비되지 않았어요.
            </p>
          )}
          <QuestionList items={items} />
        </>
      ) : (
        <div className="border-hairline bg-surface rounded-[14px] border p-8 text-center">
          <MessageCircleQuestion className="text-muted-foreground mx-auto size-8" />
          <p className="text-muted-foreground mt-3 text-sm">
            Q&amp;A는 학생 계정에서 이용할 수 있어요.
          </p>
        </div>
      )}
    </Shell>
  );
}

function Shell({
  children,
  notifItems,
  unreadCount,
}: {
  children: React.ReactNode;
  notifItems: NotificationItem[];
  unreadCount: number;
}) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <Wordmark size="md" />
          <DashboardNav active="qna" />
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell items={notifItems} unreadCount={unreadCount} />
          <ThemeToggle />
          <div className="hidden md:block">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 space-y-6">
        {children}
      </main>
    </div>
  );
}
