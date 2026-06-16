-- ============================================================================
-- 입시 인사이드 — 초기 스키마 (인증/승인 기반)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: auth.users와 1:1, 역할/상태/개인정보 보관
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'student', 'parent')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  full_name text not null,
  phone text not null,
  school text,
  grade int check (grade between 1 and 3),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  -- 학생 역할일 때만 school/grade 필수
  constraint student_requires_school_grade
    check (role <> 'student' or (school is not null and grade is not null))
);

create index profiles_role_status_idx on public.profiles (role, status);
create index profiles_phone_idx on public.profiles (phone);

-- 학부모-학생 다대다 연결 (실제론 보통 1:1~1:2)
-- 승인 시 어드민이 학부모-학생을 매칭하여 link 생성
create table public.parent_student_links (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

create index parent_student_links_student_idx on public.parent_student_links (student_id);

-- ---------------------------------------------------------------------------
-- 신원 확인 보조: 학부모 가입 시 자녀 정보(이름/전화)를 보관, 어드민 매칭용
-- ---------------------------------------------------------------------------
create table public.parent_signup_requests (
  parent_id uuid primary key references public.profiles(id) on delete cascade,
  student_full_name text not null,
  student_phone text not null,
  matched_student_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper: 현재 사용자의 role/status 조회
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_profile_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select status from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.parent_signup_requests enable row level security;

-- profiles: 본인 select/update (제한 컬럼), admin은 전체
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_self_basic"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and status = (select status from public.profiles where id = auth.uid())
  );

create policy "profiles_admin_all"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 학부모는 연결된 자녀 학생 profile select 가능
create policy "profiles_parent_can_see_linked_student"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = auth.uid() and psl.student_id = profiles.id
    )
  );

-- parent_student_links: 본인 관련 row만 select, 관리는 admin만
create policy "psl_select_self_or_admin"
  on public.parent_student_links for select
  to authenticated
  using (
    parent_id = auth.uid()
    or student_id = auth.uid()
    or public.is_admin()
  );

create policy "psl_admin_all"
  on public.parent_student_links for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- parent_signup_requests: 본인 row만 select, admin 전체 관리
create policy "psr_select_self_or_admin"
  on public.parent_signup_requests for select
  to authenticated
  using (parent_id = auth.uid() or public.is_admin());

create policy "psr_admin_all"
  on public.parent_signup_requests for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 가입 트리거: auth.users 생성 시 profiles 빈 row 자동 생성 안 함
-- (실제 가입은 service_role을 통해 server action에서 profile insert까지 수행)
-- ---------------------------------------------------------------------------
