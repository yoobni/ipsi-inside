-- ============================================================================
-- 일일 출석/과제/테스트 마킹 (노션 대체)
-- ============================================================================

create table public.daily_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,                                       -- KST 기준 날짜
  attendance text check (attendance in ('present', 'late', 'absent')),
  homework_grade text check (homework_grade in ('S', 'A', 'B', 'F')),
  test_score int check (test_score between 0 and 100),
  note text,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);

create index daily_attendance_date_idx
  on public.daily_attendance (date desc, student_id);
create index daily_attendance_student_date_idx
  on public.daily_attendance (student_id, date desc);

-- RLS
alter table public.daily_attendance enable row level security;

create policy "daily_admin_all"
  on public.daily_attendance for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "daily_self_read"
  on public.daily_attendance for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = auth.uid()
        and psl.student_id = daily_attendance.student_id
    )
  );
