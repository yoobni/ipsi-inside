import { Button } from "@/components/ui/button";
import { adminLogoutAction } from "@/app/login/actions";

export function AdminTopBar() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">입시 인사이드</span>
          <span className="text-xs text-muted-foreground">/ 어드민</span>
        </div>
        <form action={adminLogoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            로그아웃
          </Button>
        </form>
      </div>
    </header>
  );
}
