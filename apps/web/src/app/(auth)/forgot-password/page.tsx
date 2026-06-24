import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell tagline="입력한 이메일로 재설정 링크를 보내드릴게요.">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-[34px] leading-tight">
            비밀번호 찾기
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드려요.
          </p>
        </div>

        <ForgotPasswordForm />

        <p className="text-xs text-faint">
          기억나셨나요?{" "}
          <Link
            href="/login"
            className="font-bold text-primary hover:underline"
          >
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
