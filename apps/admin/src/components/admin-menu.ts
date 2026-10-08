import {
  BookMarked,
  BookOpen,
  CalendarCheck,
  CalendarRange,
  FileDown,
  FileText,
  Layers,
  Megaphone,
  MessagesSquare,
  NotebookPen,
  ShieldCheck,
  Trophy,
  UserCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ADMIN_MENU, type AdminMenuItem } from "@ipsi/types";

/**
 * 메뉴의 순서·라벨·권한은 @ipsi/types ADMIN_MENU 한 곳에 있다(proxy가 같은 걸 쓴다).
 * 여기서는 href에 아이콘만 붙인다. 사이드바와 모바일 메뉴가 이걸 공유한다.
 */
const ICONS: Record<string, LucideIcon> = {
  "/members/pending": UserCheck,
  "/members": Users,
  "/groups": Layers,
  "/passages": BookOpen,
  "/tests": FileText,
  "/materials": FileDown,
  "/planner": CalendarRange,
  "/journals": NotebookPen,
  "/daily": CalendarCheck,
  "/announcements": Megaphone,
  "/columns": BookMarked,
  "/qna": MessagesSquare,
  "/ranking": Trophy,
  "/staff": UserCog,
  "/access-logs": ShieldCheck,
};

export type MenuEntry = AdminMenuItem & { icon: LucideIcon };

/** layout이 고른 href 목록(권한 필터 후)을 아이콘 붙은 항목으로 */
export function menuEntries(allowedHrefs: readonly string[]): MenuEntry[] {
  const allowed = new Set(allowedHrefs);
  return ADMIN_MENU.filter((m) => allowed.has(m.href)).map((m) => ({
    ...m,
    icon: ICONS[m.href] ?? Users,
  }));
}

export function isMenuActive(item: AdminMenuItem, pathname: string): boolean {
  return item.matchPrefix
    ? pathname.startsWith(item.matchPrefix)
    : pathname === item.href;
}
