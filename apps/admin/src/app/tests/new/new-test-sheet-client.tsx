"use client";

import type { TestSheetWithQuestions } from "@ipsi/types";
import { TestSheetForm } from "../test-sheet-form";
import { createTestSheetAction } from "../actions";

export function NewTestSheetClient() {
  return (
    <TestSheetForm
      mode="create"
      onSubmit={async (payload: TestSheetWithQuestions) => {
        const fd = new FormData();
        fd.set("payload", JSON.stringify(payload));
        const result = await createTestSheetAction(null, fd);
        return result.ok ? { ok: true } : { ok: false, message: result.message };
      }}
    />
  );
}
