"use client";

import type { PassageInput, QuestionInput } from "@ipsi/types";
import { PassageForm } from "../passage-form";

export function EditPassageClient({
  passageId,
  initialPassage,
  initialQuestions,
  usedCount,
}: {
  passageId: string;
  initialPassage: PassageInput;
  initialQuestions: QuestionInput[];
  usedCount: number;
}) {
  return (
    <PassageForm
      mode={{ kind: "edit", passageId, usedCount }}
      initialPassage={initialPassage}
      initialQuestions={initialQuestions}
    />
  );
}
