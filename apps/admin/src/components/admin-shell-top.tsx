import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { adminLogoutAction } from "@/app/login/actions";

/**
 * 사이드바와 함께 쓰는 상단 바 — 우측에 테마 토글 + 로그아웃.
 */
export function AdminShellTop() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-1 border-b bg-background px-4">
      <ThemeToggle />
      <form action={adminLogoutAction}>
        <Button type="submit" variant="ghost" size="sm">
          로그아웃
        </Button>
      </form>
    </header>
  );
}
