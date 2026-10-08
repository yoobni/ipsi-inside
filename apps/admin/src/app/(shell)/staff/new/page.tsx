import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStaffContext } from "@/lib/auth";
import { StaffForm } from "../staff-form";

export const dynamic = "force-dynamic";

export default async function NewStaffPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  if (ctx.staff.level !== "owner") redirect("/forbidden");
  const { supabase } = ctx;

  const [{ data: students }, { data: groups }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, school, grade")
      .eq("role", "student")
      .eq("status", "approved")
      .order("full_name"),
    supabase
      .from("student_groups")
      .select("id, name, archived")
      .eq("archived", false)
      .order("name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/staff">
          <ChevronLeft className="size-4" />
          조교 관리
        </Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">조교 추가</h1>
        <p className="text-muted-foreground text-sm">
          계정을 만들고 열 수 있는 메뉴와 담당 범위를 정해요. 나중에 언제든 바꿀 수 있어요.
        </p>
      </div>
      <StaffForm students={students ?? []} groups={groups ?? []} />
    </div>
  );
}
