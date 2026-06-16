# 입시 인사이드 (ipsi-inside)

폐쇄형(가입 승인제) 온라인 학원 관리 시스템. 학생/학부모/원장 3역할.

## 구조

```
ipsi-inside/
├── apps/
│   ├── web/      Next.js 16 — 학생/학부모 포털
│   └── admin/    Next.js 16 — 원장 어드민
├── packages/
│   ├── ui/       shadcn 기반 공용 컴포넌트
│   ├── lib/      Supabase 클라이언트 + 공용 유틸
│   ├── db/       DB 타입 (supabase gen types)
│   └── types/    zod 스키마 + 공용 타입
└── supabase/
    ├── migrations/
    └── seed.sql
```

## 시작하기

```bash
pnpm install
pnpm dev:web        # http://localhost:3000
pnpm dev:admin      # http://localhost:3001
```

## 환경 변수

각 앱의 `.env.local` 참고. 절대 커밋 금지.

## 스택

- Next.js 16 + TypeScript + Tailwind v4
- Supabase (Auth + Postgres + RLS)
- shadcn/ui + Tremor
- pnpm + Turborepo
