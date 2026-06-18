-- ============================================================================
-- 일일 학습 일지 + 원장 피드백 시스템
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- study_journals — 학생 일일 제출
-- ─────────────────────────────────────────────────────────────────────────────
create table public.study_journals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  journal_date date not null,                     -- KST 기준 그날
  content text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, journal_date)
);

create index study_journals_student_date_idx
  on public.study_journals (student_id, journal_date desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- journal_feedbacks — 원장 4필드 피드백 + 발행 예약
-- ─────────────────────────────────────────────────────────────────────────────
create table public.journal_feedbacks (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null unique references public.study_journals(id) on delete cascade,
  overall_comment text,
  better_than_yesterday text,
  worse_than_yesterday text,
  must_fix_tomorrow text,                         -- ★ 핵심 지침 (학생 화면 최상단 헤딩)
  written_by uuid not null references public.profiles(id),
  written_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  publish_at timestamptz                          -- null=초안, 값 있으면 그 시점부터 학생에게 노출
);

create index journal_feedbacks_publish_idx
  on public.journal_feedbacks (publish_at)
  where publish_at is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 헬퍼 함수: 미답변 일지 (피드백 없는 것)
-- ─────────────────────────────────────────────────────────────────────────────
-- (별도 함수 없이 LEFT JOIN으로 어드민에서 조회)

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.study_journals enable row level security;
alter table public.journal_feedbacks enable row level security;

-- study_journals
create policy "journals_admin_all"
  on public.study_journals for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "journals_self_read"
  on public.study_journals for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = auth.uid()
        and psl.student_id = study_journals.student_id
    )
  );

-- 학생 본인이 자기 일지 insert/update (정지 상태 차단)
create policy "journals_self_write"
  on public.study_journals for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.status = 'approved'
    )
  );

create policy "journals_self_update"
  on public.study_journals for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- journal_feedbacks: 어드민만 CUD. 학생/학부모는 발행된 것만 read.
create policy "journal_feedbacks_admin_all"
  on public.journal_feedbacks for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "journal_feedbacks_self_read_published"
  on public.journal_feedbacks for select
  to authenticated
  using (
    publish_at is not null
    and publish_at <= now()
    and exists (
      select 1 from public.study_journals j
      where j.id = journal_feedbacks.journal_id
        and (
          j.student_id = auth.uid()
          or exists (
            select 1 from public.parent_student_links psl
            where psl.parent_id = auth.uid()
              and psl.student_id = j.student_id
          )
        )
    )
  );
