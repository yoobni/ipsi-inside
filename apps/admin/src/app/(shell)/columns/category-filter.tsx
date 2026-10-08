"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CategoryFilterChoice = { id: string; label: string };

const ALL = "__all__";
/** URL 값 — 미분류 칼럼만 보기 */
export const CATEGORY_NONE = "none";

export function CategoryFilter({
  categories,
  value,
}: {
  categories: CategoryFilterChoice[];
  value: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === ALL) params.delete("category");
    else params.set("category", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <Select value={value ?? ALL} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]" aria-label="카테고리 필터">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>전체 카테고리</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.label}
          </SelectItem>
        ))}
        <SelectItem value={CATEGORY_NONE}>미분류</SelectItem>
      </SelectContent>
    </Select>
  );
}
