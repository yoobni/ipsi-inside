import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function StaffPasswordPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/login");

  const { data: me } = await ctx.supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", ctx.staff.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">비밀번호 변경</h1>
        <p className="text-muted-foreground text-sm">
          내 계정의 로그인 비밀번호를 바꿔요.
        </p>
      </div>
      <PasswordForm mustChange={me?.must_change_password === true} />
    </div>
  );
}
