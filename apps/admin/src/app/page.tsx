import { redirect } from "next/navigation";
import { firstAllowedHref } from "@ipsi/types";
import { getStaffContext } from "@/lib/auth";

export default async function HomePage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  // 원장은 가입 승인, 조교는 허용된 첫 메뉴로
  redirect(firstAllowedHref(ctx.staff.level, ctx.staff.permissions));
}
