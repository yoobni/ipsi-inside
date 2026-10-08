"use client";

import type { PassageInput, QuestionInput, TaxonomyLists } from "@ipsi/types";
import { PassageForm } from "../passage-form";

export function EditPassageClient({
  passageId,
  initialPassage,
  initialQuestions,
  usedCount,
  taxonomy,
}: {
  passageId: string;
  initialPassage: PassageInput;
  initialQuestions: QuestionInput[];
  usedCount: number;
  taxonomy: TaxonomyLists;
}) {
  return (
    <PassageForm
      mode={{ kind: "edit", passageId, usedCount }}
      initialPassage={initialPassage}
      initialQuestions={initialQuestions}
      taxonomy={taxonomy}
    />
  );
}
