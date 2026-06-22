import { z } from "zod";

/** 학생 일지 제출 — 4갈래 (한 개 이상 채워야 함) */
export const journalSubmitSchema = z
  .object({
    class_question: z.string().trim().max(2000).nullable().optional(),
    test_question: z.string().trim().max(2000).nullable().optional(),
    message_to_teacher: z.string().trim().max(2000).nullable().optional(),
    learning_log: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (v) =>
      [v.class_question, v.test_question, v.message_to_teacher, v.learning_log]
        .some((s) => s && s.trim().length > 0),
    { message: "최소 한 칸이라도 입력해주세요" },
  );

export type JournalSubmitInput = z.infer<typeof journalSubmitSchema>;

export const JOURNAL_FIELDS = [
  { key: "class_question", label: "수업 내용 질문", placeholder: "예) 오늘 배운 〈논증 구조〉 부분에서 전제-결론 관계가 헷갈렸어요" },
  { key: "test_question", label: "시험 내용 질문", placeholder: "예) 6월 모의 17번 ②번 보기, 왜 답이 아닌지 모르겠어요" },
  { key: "message_to_teacher", label: "선생님께 전달하고 싶은 것", placeholder: "예) 다음 주 수요일 학교 행사 있어서 결석할 것 같아요" },
  { key: "learning_log", label: "오늘 새로 알게 된 것", placeholder: "예) 화법-작문에서 〈청자 인식〉의 의미를 새로 정리했어요" },
] as const;

export type JournalFieldKey = (typeof JOURNAL_FIELDS)[number]["key"];

/** 원장 4필드 피드백 */
export const journalFeedbackSchema = z.object({
  overall_comment: z.string().trim().max(2000).nullable().optional(),
  better_than_yesterday: z.string().trim().max(2000).nullable().optional(),
  worse_than_yesterday: z.string().trim().max(2000).nullable().optional(),
  must_fix_tomorrow: z.string().trim().max(2000).nullable().optional(),
});

export type JournalFeedbackInput = z.infer<typeof journalFeedbackSchema>;
