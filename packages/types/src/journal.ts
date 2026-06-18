import { z } from "zod";

/** 학생 일지 제출 */
export const journalSubmitSchema = z.object({
  content: z.string().trim().min(1, "내용을 입력해주세요").max(5000),
});

export type JournalSubmitInput = z.infer<typeof journalSubmitSchema>;

/** 원장 4필드 피드백 */
export const journalFeedbackSchema = z.object({
  overall_comment: z.string().trim().max(2000).nullable().optional(),
  better_than_yesterday: z.string().trim().max(2000).nullable().optional(),
  worse_than_yesterday: z.string().trim().max(2000).nullable().optional(),
  must_fix_tomorrow: z.string().trim().max(2000).nullable().optional(),
});

export type JournalFeedbackInput = z.infer<typeof journalFeedbackSchema>;
