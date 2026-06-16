import { LogoutButton } from "@/components/logout-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * 현재 세션이 web에서 진행할 수 없는 상태일 때 (관리자 계정 또는 프로필 누락)
 * 무한 리다이렉트 대신 명시적인 "여기에 있을 수 없어요" 페이지를 렌더.
 */
export function WrongAccountNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <Alert variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
      <LogoutButton />
    </div>
  );
}
