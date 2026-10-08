import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { STAFF_PERMISSIONS, type PermissionKey } from "@ipsi/types";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStaffContext } from "@/lib/auth";
import { StaffForm } from "../staff-form";
import { StaffControls } from "../staff-controls";

export const dynamic = "force-dynamic";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  if (ctx.staff.level !== "owner") redirect("/forbidden");
  const { supabase } = ctx;

  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, phone, status, admin_level")
    .eq("id", id)
    .eq("role", "admin")
    .maybeSingle();
  if (!target) notFound();

  // 원장 계정은 이 화면에서 편집하지 않는다(실수 한 번에 어드민이 잠긴다)
  if (target.admin_level !== "assistant") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/staff">
            <ChevronLeft className="size-4" />
            조교 관리
          </Link>
        </Button>
        <div className="rounded-md border bg-card p-6">
          <h1 className="text-xl font-bold">{target.full_name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            원장 계정이에요. 원장은 모든 메뉴와 학생에 접근하며 이 화면에서 바꿀 수 없어요.
          </p>
        </div>
      </div>
    );
  }

  const [
    { data: settings },
    { data: scopeStudents },
    { data: scopeGroups },
    { data: students },
    { data: groups },
    { data: authUser },
  ] = await Promise.all([
    supabase
      .from("staff_settings")
      .select("permissions, scope_mode")
      .eq("staff_id", id)
      .maybeSingle(),
    supabase.from("staff_student_scope").select("student_id").eq("staff_id", id),
    supabase.from("staff_group_scope").select("group_id").eq("staff_id", id),
    supabase
      .from("profiles")
      .select("id, full_name, school, grade")
      .eq("role", "student")
      .eq("status", "approved")
      .order("full_name"),
    // 보관된 그룹도 — 이미 담당으로 잡혀 있으면 보여야 한다
    supabase.from("student_groups").select("id, name, archived").order("name"),
    createAdminSupabaseClient().auth.admin.getUserById(id),
  ]);

  const permissions = ((settings?.permissions ?? []) as string[]).filter(
    (p): p is PermissionKey => (STAFF_PERMISSIONS as readonly string[]).includes(p),
  );
  const groupScope = new Set((scopeGroups ?? []).map((g) => g.group_id));
  const visibleGroups = (groups ?? []).filter((g) => !g.archived || groupScope.has(g.id));
  const active = target.status === "approved";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/staff">
            <ChevronLeft className="size-4" />
            조교 관리
          </Link>
        </Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{target.full_name}</h1>
            <Badge variant="outline">조교</Badge>
            {active ? (
              <Badge variant="success">활성</Badge>
            ) : (
              <Badge variant="warning">비활성</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">{authUser?.user?.email ?? ""}</p>
        </div>
        <StaffControls staffId={id} staffName={target.full_name} active={active} />
      </div>

      <StaffForm
        staffId={id}
        initial={{
          fullName: target.full_name,
          phone: target.phone,
          email: authUser?.user?.email ?? "",
          permissions,
          scopeMode: settings?.scope_mode ?? "scoped",
          studentIds: (scopeStudents ?? []).map((s) => s.student_id),
          groupIds: [...groupScope],
        }}
        students={students ?? []}
        groups={visibleGroups}
      />
    </div>
  );
}
