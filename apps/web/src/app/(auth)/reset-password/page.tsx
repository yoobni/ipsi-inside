import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell tagline="새 비밀번호를 설정해주세요.">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-[34px] leading-tight">
            새 비밀번호 설정
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            영문과 숫자를 포함한 8자 이상으로 설정해주세요.
          </p>
        </div>

        <ResetPasswordForm />

        <p className="text-xs text-faint">
          링크가 만료됐나요?{" "}
          <Link
            href="/forgot-password"
            className="font-bold text-primary hover:underline"
          >
            다시 받기
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
