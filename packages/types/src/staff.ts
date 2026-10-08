import { z } from 'zod';
import { phoneSchema } from './auth';

/**
 * 어드민 권한 분리 — 원장(owner) / 조교(assistant).
 *
 * 둘 다 profiles.role='admin'이다(웹 앱의 "관리자는 학생 앱에 못 들어온다" 차단과
 * notifications 정책이 role='admin'을 보고 있어서). 급은 profiles.admin_level로
 * 나누고, 조교별 메뉴 권한·담당 범위는 staff_settings / staff_*_scope 에 둔다.
 *
 * 이 파일이 **메뉴·라우트·권한 키의 단일 출처**다. proxy·사이드바·모바일 메뉴·
 * 서버 액션이 전부 여기서 읽는다. 키를 더하면 DB의 staff_settings.permissions
 * CHECK 제약(마이그레이션)도 같이 늘려야 한다.
 */

export const ADMIN_LEVEL = ['owner', 'assistant'] as const;
export type AdminLevel = (typeof ADMIN_LEVEL)[number];
export const ADMIN_LEVEL_LABEL: Record<AdminLevel, string> = {
  owner: '원장',
  assistant: '조교',
};

/**
 * 조교의 학생 범위. 명시 플래그로 둔다 — "지정 행이 없으면 전체"로 하면 마지막
 * 지정을 지우는 순간 전체 개인정보가 열린다(실패 시 열림). scoped + 0명 = 아무도 못 봄.
 */
export const SCOPE_MODE = ['all', 'scoped'] as const;
export type ScopeMode = (typeof SCOPE_MODE)[number];
export const SCOPE_MODE_LABEL: Record<ScopeMode, string> = {
  all: '전체 학생',
  scoped: '담당 학생·그룹만',
};

/** 조교에게 줄 수 있는 메뉴 권한. 원장 전용 메뉴(가입승인·접속기록·조교관리·CSV)는 여기 없다. */
export const STAFF_PERMISSIONS = [
  'members',
  'groups',
  'passages',
  'tests',
  'materials',
  'planner',
  'journals',
  'daily',
  'announcements',
  'columns',
  'qna',
] as const;
export type PermissionKey = (typeof STAFF_PERMISSIONS)[number];

export const STAFF_PERMISSION_LABEL: Record<PermissionKey, string> = {
  members: '회원 열람',
  groups: '그룹(반)',
  passages: '지문/문항',
  tests: '시험 관리',
  materials: '자료 배부',
  planner: '주간 플래너',
  journals: '학습 일지',
  daily: '일일 마킹',
  announcements: '공지사항',
  columns: '칼럼',
  qna: 'Q&A',
};

/** 권한 체크박스 옆 한 줄 설명 — 무엇이 열리고 무엇은 여전히 원장만인지 */
export const STAFF_PERMISSION_HINT: Record<PermissionKey, string> = {
  members: '담당 학생·학부모 정보 열람. 정지·비밀번호 재설정·학부모 연결은 원장만',
  groups: '그룹 만들기, 담당 그룹의 멤버 관리(담당 학생만 넣을 수 있음)',
  passages: '지문·문항 등록/수정/CSV 가져오기',
  tests: '시험지 구성·배정·응시 현황(담당 학생). 결과 CSV 반출은 원장만',
  materials: '자료 등록·발행·배정(담당 학생)',
  planner: '주간 플래너 작성·발행·템플릿(담당 학생)',
  journals: '학습 일지 열람·피드백(담당 학생)',
  daily: '출석·과제·테스트 마킹(담당 학생). CSV 반출은 원장만',
  announcements: '공지 작성·발행(전체 학생·학부모에게 나감)',
  columns: '칼럼 작성·발행·카테고리 관리',
  qna: '질문 열람·답변·좋은 질문 선정(담당 학생)',
};

export const staffPermissionSchema = z.enum(STAFF_PERMISSIONS);

/**
 * 라우트 접근 수준. 'owner' = 원장만, 'staff' = 승인된 교직원 누구나(계정 화면 등),
 * 그 외 = 해당 메뉴 권한 필요.
 */
export type RouteAccess = PermissionKey | 'owner' | 'staff';

export type AdminMenuItem = {
  href: string;
  label: string;
  access: PermissionKey | 'owner';
  /** 활성 표시 기준 prefix. 없으면 href와 정확히 일치할 때만 활성 */
  matchPrefix?: string;
};

/** 사이드바·모바일 메뉴 순서. 아이콘은 apps/admin 쪽에서 href로 붙인다. */
export const ADMIN_MENU: AdminMenuItem[] = [
  { href: '/members/pending', label: '가입 승인', access: 'owner', matchPrefix: '/members/pending' },
  { href: '/members', label: '회원 관리', access: 'members' },
  { href: '/groups', label: '그룹(반)', access: 'groups', matchPrefix: '/groups' },
  { href: '/passages', label: '지문/문항', access: 'passages', matchPrefix: '/passages' },
  { href: '/tests', label: '시험 관리', access: 'tests', matchPrefix: '/tests' },
  { href: '/materials', label: '자료 배부', access: 'materials', matchPrefix: '/materials' },
  { href: '/planner', label: '주간 플래너', access: 'planner', matchPrefix: '/planner' },
  { href: '/journals', label: '학습 일지', access: 'journals', matchPrefix: '/journals' },
  { href: '/daily', label: '일일 마킹', access: 'daily', matchPrefix: '/daily' },
  { href: '/announcements', label: '공지사항', access: 'announcements', matchPrefix: '/announcements' },
  { href: '/columns', label: '칼럼', access: 'columns', matchPrefix: '/columns' },
  { href: '/qna', label: 'Q&A', access: 'qna', matchPrefix: '/qna' },
  { href: '/staff', label: '조교 관리', access: 'owner', matchPrefix: '/staff' },
  { href: '/access-logs', label: '접속기록', access: 'owner', matchPrefix: '/access-logs' },
];

/**
 * 경로 → 필요한 접근 수준. **구체적인 규칙이 먼저** 와야 한다 —
 * /members/pending(원장)이 /members(회원 열람)보다 앞에 있는 식.
 */
export const ADMIN_ROUTE_RULES: ReadonlyArray<{ pattern: RegExp; access: RouteAccess }> = [
  { pattern: /^\/members\/pending(\/|$)/, access: 'owner' },
  { pattern: /^\/daily\/export(\/|$)/, access: 'owner' },
  { pattern: /^\/tests\/[^/]+\/export(\/|$)/, access: 'owner' },
  { pattern: /^\/access-logs(\/|$)/, access: 'owner' },
  { pattern: /^\/staff(\/|$)/, access: 'owner' },
  { pattern: /^\/ranking(\/|$)/, access: 'owner' },
  { pattern: /^\/account(\/|$)/, access: 'staff' },
  { pattern: /^\/forbidden(\/|$)/, access: 'staff' },
  { pattern: /^\/members(\/|$)/, access: 'members' },
  { pattern: /^\/groups(\/|$)/, access: 'groups' },
  { pattern: /^\/passages(\/|$)/, access: 'passages' },
  { pattern: /^\/tests(\/|$)/, access: 'tests' },
  { pattern: /^\/materials(\/|$)/, access: 'materials' },
  { pattern: /^\/planner(\/|$)/, access: 'planner' },
  { pattern: /^\/journals(\/|$)/, access: 'journals' },
  { pattern: /^\/daily(\/|$)/, access: 'daily' },
  { pattern: /^\/announcements(\/|$)/, access: 'announcements' },
  { pattern: /^\/columns(\/|$)/, access: 'columns' },
  { pattern: /^\/qna(\/|$)/, access: 'qna' },
];

/** 규칙에 없는 경로(/, /api/* 등)는 교직원이면 통과 — 그 화면이 알아서 처리한다. */
export function requiredAccessForPath(pathname: string): RouteAccess {
  for (const rule of ADMIN_ROUTE_RULES) {
    if (rule.pattern.test(pathname)) return rule.access;
  }
  return 'staff';
}

export function staffCanAccess(
  level: AdminLevel,
  permissions: ReadonlySet<PermissionKey> | readonly PermissionKey[],
  access: RouteAccess,
): boolean {
  if (level === 'owner') return true;
  if (access === 'owner') return false;
  if (access === 'staff') return true;
  return Array.isArray(permissions)
    ? permissions.includes(access)
    : (permissions as ReadonlySet<PermissionKey>).has(access);
}

export function visibleMenu(
  level: AdminLevel,
  permissions: ReadonlySet<PermissionKey> | readonly PermissionKey[],
): AdminMenuItem[] {
  return ADMIN_MENU.filter((m) => staffCanAccess(level, permissions, m.access));
}

/** 로그인·루트 리다이렉트 목적지. 권한이 하나도 없는 조교는 /forbidden 으로. */
export function firstAllowedHref(
  level: AdminLevel,
  permissions: ReadonlySet<PermissionKey> | readonly PermissionKey[],
): string {
  return visibleMenu(level, permissions)[0]?.href ?? '/forbidden';
}

// ── 입력 스키마 (조교 관리 화면) ─────────────────────────────────────────────
export const staffInputSchema = z.object({
  fullName: z.string().trim().min(2, '이름을 입력해주세요').max(20),
  phone: phoneSchema,
  permissions: z.array(staffPermissionSchema).max(STAFF_PERMISSIONS.length),
  scopeMode: z.enum(SCOPE_MODE),
  studentIds: z.array(z.string().uuid()).max(500),
  groupIds: z.array(z.string().uuid()).max(100),
});
export type StaffInput = z.infer<typeof staffInputSchema>;

export const createStaffSchema = staffInputSchema.extend({
  email: z.string().trim().email('올바른 이메일 형식이 아닙니다'),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
