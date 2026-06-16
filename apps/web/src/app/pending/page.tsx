import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";

export default async function PendingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login");
  if (profile.status === "approved") redirect("/dashboard");

  const statusMessage = {
    pending: "관리자 승인 대기 중입니다. 승인이 완료되면 강의/리포트에 접근할 수 있습니다.",
    rejected: "가입 신청이 반려되었습니다. 학원에 문의해주세요.",
    suspended: "계정이 일시 정지되었습니다. 학원에 문의해주세요.",
  } as const;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {profile.full_name}님, 안녕하세요
          </CardTitle>
          <CardDescription>
            {profile.role === "student" ? "학생" : "학부모"} 계정으로 가입되었습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-foreground">
            {statusMessage[profile.status as keyof typeof statusMessage] ??
              "계정 상태를 확인할 수 없습니다."}
          </p>
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  );
}
