-- ============================================================================
-- 학생 그룹(반) — 원장이 임의로 만들고 학생을 담는 상위 그룹 시스템.
--   자료/시험/마킹 등 모든 대상 지정의 척추.
--   멤버십은 동적: 그룹에 학생을 넣으면 그 그룹에 배부된 자료·시험이 자동으로 따라감.
-- ============================================================================

create table public.student_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,                          -- UI 뱃지 색 (선택)
  description text,
  archived boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index student_groups_active_idx
  on public.student_groups (archived, name);

create trigger tr_student_groups_touch
  before update on public.student_groups
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- group_members — 그룹 ↔ 학생 (N:M). 동적 멤버십.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.group_members (
  group_id uuid not null references public.student_groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid not null references public.profiles(id),
  added_at timestamptz not null default now(),
  primary key (group_id, student_id)
);

create index group_members_student_idx
  on public.group_members (student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.student_groups enable row level security;
alter table public.group_members enable row level security;

-- admin 전체
create policy "student_groups_admin_all"
  on public.student_groups for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "group_members_admin_all"
  on public.group_members for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 학생/학부모: 본인(또는 자녀)이 속한 그룹의 멤버십만 read.
--   자료/시험 RLS가 group_members를 조인해 대상 여부를 판정하므로 이 read 경로가 필요.
create policy "group_members_self_read"
  on public.group_members for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = auth.uid()
        and psl.student_id = group_members.student_id
    )
  );

-- 학생/학부모: 본인(또는 자녀)이 속한 그룹의 메타(이름/색)만 read.
create policy "student_groups_member_read"
  on public.student_groups for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = student_groups.id
        and (
          gm.student_id = auth.uid()
          or exists (
            select 1 from public.parent_student_links psl
            where psl.parent_id = auth.uid()
              and psl.student_id = gm.student_id
          )
        )
    )
  );
