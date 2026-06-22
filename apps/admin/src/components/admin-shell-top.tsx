import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { AdminMobileMenu } from "@/components/admin-mobile-menu";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { getMyNotifications } from "@/lib/notifications";
import { adminLogoutAction } from "@/app/login/actions";

/**
 * 사이드바와 함께 쓰는 상단 바 — 모바일 메뉴 + 알림 종 + 테마 토글 + 로그아웃.
 */
export async function AdminShellTop() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const notif = user
    ? await getMyNotifications(supabase, user.id)
    : { items: [], unreadCount: 0 };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-1 border-b bg-background px-4">
      <AdminMobileMenu />
      <div className="ml-auto flex items-center gap-1">
        <NotificationBell items={notif.items} unreadCount={notif.unreadCount} />
        <ThemeToggle />
        <form action={adminLogoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            로그아웃
          </Button>
        </form>
      </div>
    </header>
  );
}
