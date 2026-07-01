"use client";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(auth)/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" size="sm" className="w-full">
        로그아웃
      </Button>
    </form>
  );
}
