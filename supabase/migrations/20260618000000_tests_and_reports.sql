-- ============================================================================
-- 시험 리포트 시스템
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- test_sheets — 시험지 메타
-- ─────────────────────────────────────────────────────────────────────────────
create table public.test_sheets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target_school text,
  target_grade int check (target_grade between 1 and 3),
  test_date date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index test_sheets_created_at_idx on public.test_sheets (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- test_questions — 시험지 문항
-- ─────────────────────────────────────────────────────────────────────────────
create table public.test_questions (
  id uuid primary key default gen_random_uuid(),
  test_sheet_id uuid not null references public.test_sheets(id) on delete cascade,
  question_no int not null check (question_no >= 1),
  correct_answer int not null check (correct_answer between 1 and 5),
  unit_major text not null,                    -- 대단원: 문법, 문학, 독서, 화작, 언매
  unit_minor text,                              -- 소단원: 품사, 현대시 등
  difficulty text check (difficulty in ('상', '중', '하')),
  points int not null default 1 check (points >= 1),
  unique (test_sheet_id, question_no)
);

create index test_questions_sheet_idx on public.test_questions (test_sheet_id, question_no);
create index test_questions_unit_idx on public.test_questions (test_sheet_id, unit_major);

-- ─────────────────────────────────────────────────────────────────────────────
-- test_assignments — 시험지 ↔ 학생 배정 (N:M)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.test_assignments (
  id uuid primary key default gen_random_uuid(),
  test_sheet_id uuid not null references public.test_sheets(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'assigned'
    check (status in ('assigned', 'graded')),
  unique (test_sheet_id, student_id)
);

create index test_assignments_sheet_idx on public.test_assignments (test_sheet_id);
create index test_assignments_student_idx on public.test_assignments (student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- student_answers — 학생 답안 (자동 채점)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.student_answers (
  id uuid primary key default gen_random_uuid(),
  test_sheet_id uuid not null references public.test_sheets(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_no int not null,
  selected int check (selected between 1 and 5),  -- null = 미응답
  is_correct boolean not null default false,
  marked_by uuid not null references public.profiles(id),
  marked_at timestamptz not null default now(),
  unique (test_sheet_id, student_id, question_no)
);

create index student_answers_sheet_student_idx
  on public.student_answers (test_sheet_id, student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 자동 채점 트리거: student_answers 삽입/수정 시 is_correct 자동 계산
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.calc_student_answer_correctness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correct int;
begin
  select correct_answer into v_correct
  from public.test_questions
  where test_sheet_id = new.test_sheet_id
    and question_no = new.question_no;
  if v_correct is null then
    raise exception '문항 정답 없음 (sheet=%, no=%)', new.test_sheet_id, new.question_no;
  end if;
  new.is_correct := (new.selected is not null and new.selected = v_correct);
  return new;
end;
$$;

create trigger trg_student_answers_grade
  before insert or update of selected on public.student_answers
  for each row
  execute function public.calc_student_answer_correctness();

-- ─────────────────────────────────────────────────────────────────────────────
-- 집계 함수: 학생별 시험별 단원별 정답률
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.test_unit_stats(
  p_test_sheet_id uuid,
  p_student_id uuid
)
returns table (
  unit_major text,
  unit_minor text,
  total int,
  correct int,
  accuracy numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.unit_major,
    q.unit_minor,
    count(*)::int as total,
    sum(case when sa.is_correct then 1 else 0 end)::int as correct,
    round(
      (sum(case when sa.is_correct then 1 else 0 end)::numeric / count(*)::numeric) * 100,
      1
    ) as accuracy
  from public.test_questions q
  left join public.student_answers sa
    on sa.test_sheet_id = q.test_sheet_id
   and sa.question_no = q.question_no
   and sa.student_id = p_student_id
  where q.test_sheet_id = p_test_sheet_id
  group by q.unit_major, q.unit_minor
  order by q.unit_major, q.unit_minor;
$$;

create or replace function public.test_total_score(
  p_test_sheet_id uuid,
  p_student_id uuid
)
returns table (
  total_questions int,
  correct_count int,
  total_points int,
  earned_points int,
  score_percent numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(q.id)::int as total_questions,
    sum(case when sa.is_correct then 1 else 0 end)::int as correct_count,
    coalesce(sum(q.points), 0)::int as total_points,
    coalesce(sum(case when sa.is_correct then q.points else 0 end), 0)::int as earned_points,
    case
      when coalesce(sum(q.points), 0) = 0 then 0
      else round(
        sum(case when sa.is_correct then q.points else 0 end)::numeric
        / sum(q.points)::numeric * 100,
        1
      )
    end as score_percent
  from public.test_questions q
  left join public.student_answers sa
    on sa.test_sheet_id = q.test_sheet_id
   and sa.question_no = q.question_no
   and sa.student_id = p_student_id
  where q.test_sheet_id = p_test_sheet_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.test_sheets enable row level security;
alter table public.test_questions enable row level security;
alter table public.test_assignments enable row level security;
alter table public.student_answers enable row level security;

-- test_sheets: 어드민만 CUD. 배정된 학생/연결 학부모는 read 가능.
create policy "test_sheets_admin_all"
  on public.test_sheets for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "test_sheets_assigned_read"
  on public.test_sheets for select
  to authenticated
  using (
    exists (
      select 1 from public.test_assignments ta
      where ta.test_sheet_id = test_sheets.id
        and ta.student_id = auth.uid()
    )
    or exists (
      select 1 from public.test_assignments ta
      join public.parent_student_links psl on psl.student_id = ta.student_id
      where ta.test_sheet_id = test_sheets.id
        and psl.parent_id = auth.uid()
    )
  );

-- test_questions: 어드민 전체, 배정된 학생/학부모는 read (정답은 채점 후만 — 일단 풀 허용)
create policy "test_questions_admin_all"
  on public.test_questions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "test_questions_assigned_read"
  on public.test_questions for select
  to authenticated
  using (
    exists (
      select 1 from public.test_assignments ta
      where ta.test_sheet_id = test_questions.test_sheet_id
        and ta.student_id = auth.uid()
    )
    or exists (
      select 1 from public.test_assignments ta
      join public.parent_student_links psl on psl.student_id = ta.student_id
      where ta.test_sheet_id = test_questions.test_sheet_id
        and psl.parent_id = auth.uid()
    )
  );

-- test_assignments: 어드민 전체, 학생/학부모는 본인/자녀 것만 read
create policy "test_assignments_admin_all"
  on public.test_assignments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "test_assignments_self_read"
  on public.test_assignments for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = auth.uid()
        and psl.student_id = test_assignments.student_id
    )
  );

-- student_answers: 어드민 전체, 학생/학부모는 본인/자녀 것만 read
create policy "student_answers_admin_all"
  on public.student_answers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "student_answers_self_read"
  on public.student_answers for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = auth.uid()
        and psl.student_id = student_answers.student_id
    )
  );
