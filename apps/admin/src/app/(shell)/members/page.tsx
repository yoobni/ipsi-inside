import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { MembersTable } from "./members-table";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const supabase = await createServerSupabaseClient();

  const { data: members } = await supabase
    .from("profiles")
    .select(
      "id, role, status, full_name, phone, school, grade, created_at, approved_at",
    )
    .in("status", ["approved", "suspended", "rejected"])
    .neq("role", "admin")
    .order("full_name");

  const { data: links } = await supabase
    .from("parent_student_links")
    .select("parent_id, student_id");

  const approvedStudents = (members ?? []).filter(
    (m) => m.role === "student" && m.status === "approved",
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">회원 관리</h1>
        <p className="text-muted-foreground text-sm">
          승인된 학생/학부모 계정 전체를 관리해요. 정지·연결 변경이 가능해요.
        </p>
      </div>

      <MembersTable
        members={members ?? []}
        links={links ?? []}
        approvedStudents={approvedStudents}
      />
    </div>
  );
}
