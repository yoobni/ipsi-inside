import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

/**
 * 비밀번호는 선생님이 재설정해 준다.
 *
 * 메일 발송 흐름(ForgotPasswordForm + requestPasswordResetAction)은 코드에
 * 그대로 남겨뒀다. 다만 이 서비스는 가입 시 이메일을 실제로 검증하지 않아
 * (`email_confirm: true`로 자동 확인) 오타 주소를 적은 학생은 메일을 영원히
 * 받지 못한다. 커스텀 SMTP와 가입 시 실인증을 붙이기 전까지는 안내만 한다.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthShell tagline="선생님이 새 비밀번호를 만들어 드려요.">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-[34px] leading-tight">
            비밀번호를 잊었어요
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            선생님께 말씀하시면 새 비밀번호를 만들어 드려요.
          </p>
        </div>

        <div className="border-hairline bg-surface space-y-3 rounded-[14px] border p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="text-primary size-4" />
            <p className="text-sm font-bold">이렇게 진행돼요</p>
          </div>
          <ol className="text-muted-foreground space-y-2 text-sm">
            <li>1. 선생님께 비밀번호를 잊었다고 말씀해요.</li>
            <li>2. 선생님이 임시 비밀번호를 만들어 알려주세요.</li>
            <li>3. 그 비밀번호로 로그인하면 새 비밀번호를 정하는 화면이 떠요.</li>
          </ol>
          <p className="text-faint text-xs">
            임시 비밀번호는 선생님도 알고 있으니, 로그인한 뒤 꼭 새로 정해주세요.
          </p>
        </div>

        <p className="text-faint text-xs">
          기억나셨나요?{" "}
          <Link href="/login" className="text-primary font-bold hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
