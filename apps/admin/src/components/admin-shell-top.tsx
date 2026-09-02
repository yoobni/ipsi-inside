import { Suspense } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { AdminMobileMenu } from "@/components/admin-mobile-menu";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";
import { getMyNotifications } from "@/lib/notifications";
import { adminLogoutAction } from "@/app/login/actions";

/**
 * 사이드바와 함께 쓰는 상단 바 — 모바일 메뉴 + 알림 종 + 테마 토글 + 로그아웃.
 *
 * 이 컴포넌트 자체는 데이터를 기다리지 않는다. 예전엔 여기서 곧바로
 * getUser + 알림 2쿼리를 await 했는데, 이 상단 바는 섹션마다 있는 layout에
 * 들어가므로 **메뉴를 바꿀 때마다** 그 왕복이 화면 전체를 막았다(플래너에서
 * 자료 배부로 넘어갈 때 체감되던 지연). 알림만 Suspense 뒤로 흘려보내면
 * 셸은 즉시 그려지고 종만 뒤늦게 채워진다.
 */
export function AdminShellTop() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-1 border-b bg-background px-4">
      <AdminMobileMenu />
      <div className="ml-auto flex items-center gap-1">
        <Suspense fallback={<NotificationBellSkeleton />}>
          <NotificationBellSlot />
        </Suspense>
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

async function NotificationBellSlot() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const notif = user
    ? await getMyNotifications(supabase, user.id)
    : { items: [], unreadCount: 0 };

  return (
    <NotificationBell items={notif.items} unreadCount={notif.unreadCount} />
  );
}

/**
 * 알림이 도착하기 전의 자리. 빈 목록을 넘긴 진짜 종을 띄우면 눌렀을 때
 * "알림이 없어요"가 떠서 있는 알림을 없다고 알려주게 된다 — 그래서 같은
 * 크기의 비활성 버튼으로 자리만 잡는다(레이아웃이 흔들리지 않게).
 */
function NotificationBellSkeleton() {
  return (
    <span
      aria-hidden
      className="text-muted-foreground/50 inline-flex size-9 items-center justify-center rounded-md"
    >
      <Bell className="size-4" />
    </span>
  );
}
