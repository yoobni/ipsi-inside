import Link from "next/link";
import { Button } from "@/components/ui/button";
import { adminLogoutAction } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";

export function AdminTopBar() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          aria-label="어드민 홈으로"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <span className="text-base font-semibold">
            입시인사이드<span className="text-primary">.</span>
          </span>
          <span className="text-xs text-muted-foreground">/ 어드민</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action={adminLogoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              로그아웃
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
