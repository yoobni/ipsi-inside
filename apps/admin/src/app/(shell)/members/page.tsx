import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth";
import { MembersTable } from "./members-table";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");
  const { supabase, staff } = ctx;
  // 정지·학부모 연결 변경은 원장만. 조교는 담당 학생·학부모 열람만(RLS가 목록을 거른다).
  const canManage = staff.level === "owner";

  // 회원 목록과 학부모-학생 링크는 서로 독립 — 한 번에
  const [{ data: members }, { data: links }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, role, status, full_name, phone, school, grade, created_at, approved_at",
      )
      .in("status", ["approved", "suspended", "rejected"])
      .neq("role", "admin")
      .order("full_name"),
    supabase.from("parent_student_links").select("parent_id, student_id"),
  ]);

  const approvedStudents = (members ?? []).filter(
    (m) => m.role === "student" && m.status === "approved",
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">회원 관리</h1>
        <p className="text-muted-foreground text-sm">
          {canManage
            ? "승인된 학생/학부모 계정 전체를 관리해요. 정지·연결 변경이 가능해요."
            : "담당 학생과 연결된 학부모 계정을 열람해요. 정지·연결 변경은 원장만 할 수 있어요."}
        </p>
      </div>

      <MembersTable
        members={members ?? []}
        links={links ?? []}
        approvedStudents={approvedStudents}
        canManage={canManage}
      />
    </div>
  );
}
