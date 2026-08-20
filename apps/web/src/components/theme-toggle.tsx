"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * 테마 전환.
 *
 * mounted 플래그(useEffect로 setState)를 쓰지 않는다. 서버·클라이언트가 다른
 * 아이콘을 그리는 걸 막으려던 장치였지만, next-themes가 <html>에 .dark를
 * 붙여주므로 아이콘 선택은 CSS로 하면 된다. 상태와 이펙트가 사라지고
 * 첫 렌더에 아이콘이 잠깐 비는 일도 없다.
 */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="테마 전환"
      className="rounded-full"
    >
      {/* 다크일 때 해, 라이트일 때 달 — 누르면 바뀌는 방향을 보여준다 */}
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  );
}
