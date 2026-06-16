"use client";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(auth)/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" className="w-full">
        로그아웃
      </Button>
    </form>
  );
}
