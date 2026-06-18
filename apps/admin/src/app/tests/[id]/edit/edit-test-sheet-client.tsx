"use client";

import { useRouter } from "next/navigation";
import type { TestSheetWithQuestions } from "@ipsi/types";
import { TestSheetForm } from "../../test-sheet-form";
import { updateTestSheetAction } from "../../actions";

export function EditTestSheetClient({
  testSheetId,
  defaultValues,
}: {
  testSheetId: string;
  defaultValues: TestSheetWithQuestions;
}) {
  const router = useRouter();
  return (
    <TestSheetForm
      mode="edit"
      defaultValues={defaultValues}
      onSubmit={async (payload) => {
        const fd = new FormData();
        fd.set("payload", JSON.stringify(payload));
        const result = await updateTestSheetAction(testSheetId, null, fd);
        if (result.ok) {
          router.push(`/tests/${testSheetId}`);
          return { ok: true };
        }
        return { ok: false, message: result.message };
      }}
    />
  );
}
