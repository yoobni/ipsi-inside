-- ============================================================================
-- 공지사항 — 학원 단위 안내. 학생/학부모 dashboard 상단 배너 + 알림
-- ============================================================================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  audience text not null default 'all'
    check (audience in ('all', 'student', 'parent')),
  is_published boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index announcements_published_idx
  on public.announcements (is_published, published_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.announcements enable row level security;

-- admin 전체
create policy "announcements_admin_all"
  on public.announcements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 학생/학부모: published + 만료 안된 것만 + 본인 대상
create policy "announcements_audience_read"
  on public.announcements for select
  to authenticated
  using (
    is_published = true
    and (published_at is null or published_at <= now())
    and (expires_at is null or expires_at > now())
    and (
      audience = 'all'
      or (
        audience = 'student'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'student'
        )
      )
      or (
        audience = 'parent'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'parent'
        )
      )
    )
  );

create trigger tr_announcements_touch
  before update on public.announcements
  for each row execute function public.touch_updated_at();
