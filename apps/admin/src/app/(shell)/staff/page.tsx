import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import {
  ADMIN_LEVEL_LABEL,
  SCOPE_MODE_LABEL,
  STAFF_PERMISSION_LABEL,
  type PermissionKey,
} from "@ipsi/types";
import { formatPhone } from "@ipsi/lib/format";
import { createAdminSupabaseClient } from "@ipsi/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStaffContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  if (ctx.staff.level !== "owner") redirect("/forbidden");
  const { supabase } = ctx;

  const [{ data: staff }, { data: settings }, { data: scopeStudents }, { data: scopeGroups }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, status, admin_level, created_at")
        .eq("role", "admin")
        .order("admin_level")
        .order("created_at"),
      supabase.from("staff_settings").select("staff_id, permissions, scope_mode"),
      supabase.from("staff_student_scope").select("staff_id"),
      supabase.from("staff_group_scope").select("staff_id"),
    ]);

  // 이메일은 auth에만 있다 — 원장 전용 화면이라 service_role로 한 번에 가져온다
  const { data: users } = await createAdminSupabaseClient().auth.admin.listUsers({
    perPage: 1000,
  });
  const emailOf = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""] as const));
  const settingsOf = new Map((settings ?? []).map((s) => [s.staff_id, s] as const));
  const countBy = (rows: { staff_id: string }[] | null) => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r) => m.set(r.staff_id, (m.get(r.staff_id) ?? 0) + 1));
    return m;
  };
  const studentCount = countBy(scopeStudents);
  const groupCount = countBy(scopeGroups);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">조교 관리</h1>
          <p className="text-muted-foreground text-sm">
            조교 계정을 만들고 열 수 있는 메뉴와 담당 학생·그룹을 정해요. 가입 승인·접속기록·
            CSV 반출·회원 계정 조작은 원장만 할 수 있어요.
          </p>
        </div>
        <Button asChild>
          <Link href="/staff/new">
            <Plus className="size-4" />
            조교 추가
          </Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 border-b">
            <tr className="[&>th]:text-muted-foreground [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>이름</th>
              <th>이메일</th>
              <th>연락처</th>
              <th>메뉴 권한</th>
              <th>담당 범위</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(staff ?? []).map((s) => {
              const isOwner = s.admin_level === "owner";
              const st = settingsOf.get(s.id);
              const perms = (st?.permissions ?? []) as PermissionKey[];
              return (
                <tr key={s.id} className="[&>td]:px-3 [&>td]:py-2.5 [&>td]:align-top">
                  <td>
                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <span className="font-medium">{s.full_name}</span>
                      ) : (
                        <Link href={`/staff/${s.id}`} className="font-medium hover:underline">
                          {s.full_name}
                        </Link>
                      )}
                      <Badge variant={isOwner ? "primary" : "outline"}>
                        {ADMIN_LEVEL_LABEL[isOwner ? "owner" : "assistant"]}
                      </Badge>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{emailOf.get(s.id) || "-"}</td>
                  <td className="text-muted-foreground">{formatPhone(s.phone)}</td>
                  <td className="text-muted-foreground">
                    {isOwner
                      ? "전체"
                      : perms.length === 0
                        ? "없음"
                        : perms.map((p) => STAFF_PERMISSION_LABEL[p]).join(" · ")}
                  </td>
                  <td className="text-muted-foreground">
                    {isOwner
                      ? "전체 학생"
                      : (st?.scope_mode ?? "scoped") === "all"
                        ? SCOPE_MODE_LABEL.all
                        : `학생 ${studentCount.get(s.id) ?? 0} · 그룹 ${groupCount.get(s.id) ?? 0}`}
                  </td>
                  <td>
                    {s.status === "approved" ? (
                      <Badge variant="success">활성</Badge>
                    ) : (
                      <Badge variant="warning">비활성</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
