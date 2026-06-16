import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, full_name, school, grade")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login");
  if (profile.status !== "approved") redirect("/pending");
  if (profile.role === "admin") redirect("/login");

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">입시 인사이드</h1>
            <p className="text-sm text-muted-foreground">
              {profile.full_name}님 ({profile.role === "student" ? "학생" : "학부모"})
            </p>
          </div>
          <LogoutButton />
        </div>

        {profile.role === "student" ? (
          <StudentDashboard
            fullName={profile.full_name}
            school={profile.school}
            grade={profile.grade}
          />
        ) : (
          <ParentDashboard fullName={profile.full_name} />
        )}
      </div>
    </div>
  );
}

function StudentDashboard({
  fullName,
  school,
  grade,
}: {
  fullName: string;
  school: string | null;
  grade: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>학생 대시보드</CardTitle>
        <CardDescription>
          {school} {grade ? `${grade}학년` : ""} · {fullName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>여기에 내 강의, 주간 학습 리포트, 과제 현황이 표시됩니다.</p>
        <p className="text-xs">(1차 빌드 — UI placeholder)</p>
      </CardContent>
    </Card>
  );
}

function ParentDashboard({ fullName }: { fullName: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>학부모 대시보드</CardTitle>
        <CardDescription>{fullName} 학부모님</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>여기에 자녀의 주간 학습 리포트와 출석/과제 현황이 표시됩니다.</p>
        <p className="text-xs">(1차 빌드 — UI placeholder)</p>
      </CardContent>
    </Card>
  );
}
