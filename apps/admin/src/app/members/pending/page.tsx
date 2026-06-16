import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingList } from "./pending-list";
import { AdminTopBar } from "@/components/admin-top-bar";

export const dynamic = "force-dynamic";

export default async function PendingMembersPage() {
  const supabase = await createServerSupabaseClient();

  const { data: pendingProfiles } = await supabase
    .from("profiles")
    .select("id, role, status, full_name, phone, school, grade, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const parentIds = (pendingProfiles ?? [])
    .filter((p) => p.role === "parent")
    .map((p) => p.id);

  const { data: parentRequests } = parentIds.length
    ? await supabase
        .from("parent_signup_requests")
        .select("parent_id, student_full_name, student_phone")
        .in("parent_id", parentIds)
    : { data: [] };

  // 이미 승인된 학생 목록 (학부모 매칭 후보)
  const { data: approvedStudents } = await supabase
    .from("profiles")
    .select("id, full_name, phone, school, grade")
    .eq("role", "student")
    .eq("status", "approved")
    .order("full_name");

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminTopBar />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">가입 승인 대기</h1>
          <p className="text-sm text-muted-foreground mt-1">
            새 가입 신청을 승인하거나 반려합니다. 학부모 계정은 자녀 학생과 연결해야 승인됩니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>대기 중 ({pendingProfiles?.length ?? 0}건)</CardTitle>
            <CardDescription>
              학생: {pendingProfiles?.filter((p) => p.role === "student").length ?? 0}건 · 학부모:{" "}
              {pendingProfiles?.filter((p) => p.role === "parent").length ?? 0}건
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PendingList
              profiles={pendingProfiles ?? []}
              parentRequests={parentRequests ?? []}
              approvedStudents={approvedStudents ?? []}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
