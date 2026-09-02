"use client";

import { PassageForm } from "../passage-form";

export function NewPassageClient() {
  return <PassageForm mode={{ kind: "create" }} />;
}
