import "server-only";

/**
 * Q&A 답변 초안 생성 어댑터 (자리만, 2026-08-27).
 *
 * 설계: 질문이 들어오면 AI가 답변 초안을 만들어 원장 화면에 띄우고, 원장이
 * 검수·수정해 발행한다. AI가 틀린 말을 할 수 있으므로 **승인 전에는 학생에게
 * 절대 안 나간다** — qna_answers.published_at이 null인 동안은 RLS가 학생 읽기를
 * 막는다(마이그레이션 20260827010000 참조).
 *
 * 지금은 실제 생성을 붙이지 않는다. 연동할 때 이 함수 본문만 Claude API 호출로
 * 바꾸면 되고, 호출부(답변 화면의 "AI 초안" 버튼)는 그대로 둔다.
 *
 * ⚠️ TODO(AI 연동): ANTHROPIC_API_KEY 발급 → @anthropic-ai/sdk 설치 →
 *   질문 body/카테고리/교재참조를 컨텍스트로 messages.create 호출 → 초안 반환.
 *   국어 강사 톤·"확실하지 않으면 단정하지 말 것" 가드레일을 시스템 프롬프트에.
 */
export async function generateAnswerDraft(_input: {
  questionBody: string;
  categoryLabel?: string | null;
  referenceLabel?: string | null;
  questionNo?: string | null;
}): Promise<{ ok: true; draft: string } | { ok: false; message: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      message: "AI 초안 기능이 아직 연결되지 않았어요. 답변을 직접 작성해주세요.",
    };
  }
  // 키가 있어도 실제 호출은 미구현 — 연동 시 여기를 채운다.
  return {
    ok: false,
    message: "AI 초안 생성이 아직 구현되지 않았어요.",
  };
}
