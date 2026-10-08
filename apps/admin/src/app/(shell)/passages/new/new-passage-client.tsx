"use client";

import type { TaxonomyLists } from "@ipsi/types";
import { PassageForm } from "../passage-form";

export function NewPassageClient({ taxonomy }: { taxonomy: TaxonomyLists }) {
  return <PassageForm mode={{ kind: "create" }} taxonomy={taxonomy} />;
}
