import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { firstAllowedHref } from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { getStaffContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 조교가 허용되지 않은 메뉴(원장 전용 또는 미부여 권한)로 들어왔을 때.
 * 권한이 하나도 없는 조교는 로그인 직후 여기로 온다.
 */
export default async function ForbiddenPage() {
  const ctx = await getStaffContext();
  const home = ctx ? firstAllowedHref(ctx.staff.level, ctx.staff.permissions) : "/login";
  const noMenus = home === "/forbidden";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <ShieldOff className="text-muted-foreground size-10" />
      <h1 className="text-xl font-bold">이 메뉴는 열 수 없어요</h1>
      <p className="text-muted-foreground text-sm">
        {noMenus
          ? "아직 부여된 메뉴 권한이 없어요. 원장님께 권한을 요청해주세요."
          : "원장 전용이거나 아직 권한이 부여되지 않은 메뉴예요. 필요하면 원장님께 요청해주세요."}
      </p>
      {!noMenus && (
        <Button asChild variant="outline">
          <Link href={home}>내 메뉴로 가기</Link>
        </Button>
      )}
    </div>
  );
}
