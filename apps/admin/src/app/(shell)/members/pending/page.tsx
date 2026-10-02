import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { PendingTable } from "./pending-table";

export const dynamic = "force-dynamic";

export default async function PendingMembersPage() {
  const supabase = await createServerSupabaseClient();

  // 대기 회원(→ 학부모 가입 요청)과 승인 학생 목록은 서로 독립 — 한 번에
  const [{ data: pendingProfiles }, { data: approvedStudents }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, role, status, full_name, phone, school, grade, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name, phone, school, grade")
        .eq("role", "student")
        .eq("status", "approved")
        .order("full_name"),
    ]);

  const parentIds = (pendingProfiles ?? [])
    .filter((p) => p.role === "parent")
    .map((p) => p.id);

  const { data: parentRequests } = parentIds.length
    ? await supabase
        .from("parent_signup_requests")
        .select("parent_id, student_full_name, student_phone")
        .in("parent_id", parentIds)
    : { data: [] };

  const studentCount = (pendingProfiles ?? []).filter(
    (p) => p.role === "student",
  ).length;
  const parentCount = (pendingProfiles ?? []).filter(
    (p) => p.role === "parent",
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">가입 승인</h1>
        <p className="text-muted-foreground text-sm">
          신규 가입 신청을 검토하고 승인/반려해요. 학부모는 승인 시 자녀 학생과 연결해야 해요.
        </p>
      </div>

      <PendingTable
        profiles={pendingProfiles ?? []}
        parentRequests={parentRequests ?? []}
        approvedStudents={approvedStudents ?? []}
        studentCount={studentCount}
        parentCount={parentCount}
      />
    </div>
  );
}
