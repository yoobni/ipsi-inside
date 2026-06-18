-- ============================================================================
-- v2 시험 시스템 — 지문(passage) ↔ 문항(question) 정규화 + 학생 응시/자동채점
-- ============================================================================
-- 기존 시험 시스템(v1)을 완전히 폐기하고 재구성한다. v1은 종이답안을 admin이
-- 마킹하는 구조였고, v2는 학생이 모바일에서 직접 풀고 자동채점되는 구조다.
--
-- 핵심 차이
--   - 문항을 시험지에 박지 않고 별도 question bank로 둠 → 재사용 가능
--   - 지문(passage) + 문항(question, N:1) — 수능 국어 구조
--   - 시험지(test_sheets) ↔ 문항(questions) 매핑 테이블로 시험지 내 순서 지정
--   - 학생별 응시 세션(test_attempts) — 재응시/임시저장/이어풀기 지원
--   - 답안(student_answers)은 attempt에 종속
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- v1 폐기 (데이터 거의 없으므로 destructive)
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.test_total_score(uuid, uuid) cascade;
drop function if exists public.test_unit_stats(uuid, uuid) cascade;
drop function if exists public.calc_student_answer_correctness() cascade;
drop table if exists public.student_answers cascade;
drop table if exists public.test_assignments cascade;
drop table if exists public.test_questions cascade;
drop table if exists public.test_sheets cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- passage_source — 지문 분류 (확장 가능, 추가 시 ALTER TYPE)
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.passage_source as enum (
    'reading',         -- 비문학(독서)
    'literature',      -- 문학
    'speech_writing',  -- 화법과작문
    'language_media'   -- 언어와매체
  );
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- passages — 지문
-- ─────────────────────────────────────────────────────────────────────────────
create table public.passages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type public.passage_source not null,
  content text not null,                -- HTML (TipTap output, 이미지/표/줄바꿈 포함)
  unit_major text not null,             -- 대단원 (예: '독서-인문', '문학-현대시')
  unit_minor text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index passages_source_idx on public.passages (source_type);
create index passages_created_idx on public.passages (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- questions — 문항 (지문에 종속, N:1)
--   〈보기〉는 문항별로 다르게 들어가므로 question 레벨에 둔다
-- ─────────────────────────────────────────────────────────────────────────────
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.passages(id) on delete cascade,
  position_in_passage int not null check (position_in_passage >= 1),
  stem text not null,                                           -- 문제 본문 HTML
  supplementary text,                                           -- 〈보기〉 HTML (선택)
  choices jsonb not null,                                       -- [{no:1, text:"<p>...</p>"}, ...] (5지선다 표준)
  correct_answer int not null check (correct_answer between 1 and 5),
  points int not null default 2 check (points between 1 and 10),
  difficulty text check (difficulty in ('상', '중', '하')),
  unit_minor text,                                              -- 문항별 세부 단원
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (passage_id, position_in_passage)
);
create index questions_passage_idx on public.questions (passage_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- test_sheets — 시험지 메타 (일정/재응시 정책 포함)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.test_sheets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  target_school text,
  target_grade int check (target_grade between 1 and 3),
  open_at timestamptz,                                          -- null이면 즉시 오픈
  due_at timestamptz,                                           -- null이면 무기한
  allow_retake boolean not null default false,
  max_attempts int check (max_attempts is null or max_attempts >= 1),  -- null+allow_retake=true면 무한
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (open_at is null or due_at is null or open_at < due_at)
);
create index test_sheets_created_idx on public.test_sheets (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- test_sheet_questions — 시험지 ↔ 문항 매핑 (M:N + 시험지 내 순서)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.test_sheet_questions (
  id uuid primary key default gen_random_uuid(),
  test_sheet_id uuid not null references public.test_sheets(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  position int not null check (position >= 1),                  -- 시험지 내 번호
  created_at timestamptz not null default now(),
  unique (test_sheet_id, position),
  unique (test_sheet_id, question_id)
);
create index tsq_sheet_idx on public.test_sheet_questions (test_sheet_id, position);

-- ─────────────────────────────────────────────────────────────────────────────
-- test_assignments — 학생 배정
--   학교 단위 배정 시 assigned_by_school에 학교명 기록 (감사/조회용)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.test_assignments (
  id uuid primary key default gen_random_uuid(),
  test_sheet_id uuid not null references public.test_sheets(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  assigned_by_school text,                                      -- 학교 단위 배정 metadata
  unique (test_sheet_id, student_id)
);
create index ta_sheet_idx on public.test_assignments (test_sheet_id);
create index ta_student_idx on public.test_assignments (student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- test_attempts — 응시 세션 (재응시/이어풀기)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.test_assignments(id) on delete cascade,
  attempt_no int not null check (attempt_no >= 1),              -- 1,2,3... 재응시면 증가
  started_at timestamptz not null default now(),
  submitted_at timestamptz,                                     -- null이면 진행 중
  score int,                                                    -- 제출 시 자동 계산
  total_points int,                                             -- 제출 시 스냅샷 (시험지 만점)
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted')),
  unique (assignment_id, attempt_no)
);
create index attempts_assignment_idx on public.test_attempts (assignment_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- student_answers — 답안 (attempt 종속)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.student_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  selected int check (selected between 1 and 5),                -- null = 미응답
  is_correct boolean,                                           -- selected 있을 때만 채워짐
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index sa_attempt_idx on public.student_answers (attempt_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 트리거 — updated_at 자동 갱신, 답안 정답 여부 자동 계산
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger tr_passages_touch
  before update on public.passages
  for each row execute function public.touch_updated_at();
create trigger tr_questions_touch
  before update on public.questions
  for each row execute function public.touch_updated_at();
create trigger tr_test_sheets_touch
  before update on public.test_sheets
  for each row execute function public.touch_updated_at();

create or replace function public.calc_student_answer_correctness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correct int;
begin
  if new.selected is null then
    new.is_correct := null;
  else
    select correct_answer into v_correct
    from public.questions
    where id = new.question_id;
    if v_correct is null then
      raise exception '문항 % 가 존재하지 않음', new.question_id;
    end if;
    new.is_correct := (new.selected = v_correct);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_student_answers_grade
  before insert or update of selected on public.student_answers
  for each row execute function public.calc_student_answer_correctness();

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC — 응시 채점 결과 집계
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.attempt_total_score(p_attempt_id uuid)
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
  from public.test_attempts ta
  join public.test_assignments asg on asg.id = ta.assignment_id
  join public.test_sheet_questions tsq on tsq.test_sheet_id = asg.test_sheet_id
  join public.questions q on q.id = tsq.question_id
  left join public.student_answers sa
    on sa.attempt_id = ta.id and sa.question_id = q.id
  where ta.id = p_attempt_id;
$$;

create or replace function public.attempt_unit_stats(p_attempt_id uuid)
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
    p.unit_major,
    coalesce(q.unit_minor, p.unit_minor) as unit_minor,
    count(*)::int as total,
    sum(case when sa.is_correct then 1 else 0 end)::int as correct,
    round(
      (sum(case when sa.is_correct then 1 else 0 end)::numeric / count(*)::numeric) * 100,
      1
    ) as accuracy
  from public.test_attempts ta
  join public.test_assignments asg on asg.id = ta.assignment_id
  join public.test_sheet_questions tsq on tsq.test_sheet_id = asg.test_sheet_id
  join public.questions q on q.id = tsq.question_id
  join public.passages p on p.id = q.passage_id
  left join public.student_answers sa
    on sa.attempt_id = ta.id and sa.question_id = q.id
  where ta.id = p_attempt_id
  group by p.unit_major, coalesce(q.unit_minor, p.unit_minor)
  order by p.unit_major;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.passages enable row level security;
alter table public.questions enable row level security;
alter table public.test_sheets enable row level security;
alter table public.test_sheet_questions enable row level security;
alter table public.test_assignments enable row level security;
alter table public.test_attempts enable row level security;
alter table public.student_answers enable row level security;

-- Admin 전체 권한 (모든 테이블)
create policy "passages_admin_all" on public.passages for all
  to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "questions_admin_all" on public.questions for all
  to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "test_sheets_admin_all" on public.test_sheets for all
  to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "test_sheet_questions_admin_all" on public.test_sheet_questions for all
  to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "test_assignments_admin_all" on public.test_assignments for all
  to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "test_attempts_admin_all" on public.test_attempts for all
  to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "student_answers_admin_all" on public.student_answers for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- 학생 — 본인 배정/시도/답안만
create policy "test_assignments_student_select" on public.test_assignments for select
  to authenticated using (student_id = auth.uid());

create policy "test_attempts_student_rw" on public.test_attempts for all
  to authenticated using (
    exists (
      select 1 from public.test_assignments asg
      where asg.id = test_attempts.assignment_id
        and asg.student_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.test_assignments asg
      where asg.id = test_attempts.assignment_id
        and asg.student_id = auth.uid()
    )
  );

create policy "student_answers_student_rw" on public.student_answers for all
  to authenticated using (
    exists (
      select 1 from public.test_attempts ta
      join public.test_assignments asg on asg.id = ta.assignment_id
      where ta.id = student_answers.attempt_id
        and asg.student_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.test_attempts ta
      join public.test_assignments asg on asg.id = ta.assignment_id
      where ta.id = student_answers.attempt_id
        and asg.student_id = auth.uid()
    )
  );

-- 학생/학부모 — 배정된 시험지에 한해 시험지/문항/지문 read
create policy "test_sheets_assigned_read" on public.test_sheets for select
  to authenticated using (
    exists (
      select 1 from public.test_assignments asg
      where asg.test_sheet_id = test_sheets.id and asg.student_id = auth.uid()
    )
    or exists (
      select 1 from public.test_assignments asg
      join public.parent_student_links psl on psl.student_id = asg.student_id
      where asg.test_sheet_id = test_sheets.id and psl.parent_id = auth.uid()
    )
  );

create policy "test_sheet_questions_assigned_read" on public.test_sheet_questions for select
  to authenticated using (
    exists (
      select 1 from public.test_assignments asg
      where asg.test_sheet_id = test_sheet_questions.test_sheet_id
        and asg.student_id = auth.uid()
    )
    or exists (
      select 1 from public.test_assignments asg
      join public.parent_student_links psl on psl.student_id = asg.student_id
      where asg.test_sheet_id = test_sheet_questions.test_sheet_id
        and psl.parent_id = auth.uid()
    )
  );

create policy "questions_assigned_read" on public.questions for select
  to authenticated using (
    exists (
      select 1 from public.test_sheet_questions tsq
      join public.test_assignments asg on asg.test_sheet_id = tsq.test_sheet_id
      where tsq.question_id = questions.id and asg.student_id = auth.uid()
    )
    or exists (
      select 1 from public.test_sheet_questions tsq
      join public.test_assignments asg on asg.test_sheet_id = tsq.test_sheet_id
      join public.parent_student_links psl on psl.student_id = asg.student_id
      where tsq.question_id = questions.id and psl.parent_id = auth.uid()
    )
  );

create policy "passages_assigned_read" on public.passages for select
  to authenticated using (
    exists (
      select 1 from public.questions q
      join public.test_sheet_questions tsq on tsq.question_id = q.id
      join public.test_assignments asg on asg.test_sheet_id = tsq.test_sheet_id
      where q.passage_id = passages.id and asg.student_id = auth.uid()
    )
    or exists (
      select 1 from public.questions q
      join public.test_sheet_questions tsq on tsq.question_id = q.id
      join public.test_assignments asg on asg.test_sheet_id = tsq.test_sheet_id
      join public.parent_student_links psl on psl.student_id = asg.student_id
      where q.passage_id = passages.id and psl.parent_id = auth.uid()
    )
  );

-- 학부모 — 자녀 배정/시도/답안 read
create policy "test_assignments_parent_read" on public.test_assignments for select
  to authenticated using (
    exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = auth.uid()
        and psl.student_id = test_assignments.student_id
    )
  );

create policy "test_attempts_parent_read" on public.test_attempts for select
  to authenticated using (
    exists (
      select 1 from public.test_assignments asg
      join public.parent_student_links psl on psl.student_id = asg.student_id
      where asg.id = test_attempts.assignment_id and psl.parent_id = auth.uid()
    )
  );

create policy "student_answers_parent_read" on public.student_answers for select
  to authenticated using (
    exists (
      select 1 from public.test_attempts ta
      join public.test_assignments asg on asg.id = ta.assignment_id
      join public.parent_student_links psl on psl.student_id = asg.student_id
      where ta.id = student_answers.attempt_id and psl.parent_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 이미지 첨부용 Storage 버킷 (한자 외 그림/표 이미지)
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('question-assets', 'question-assets', true)
on conflict (id) do nothing;

create policy "question_assets_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'question-assets');

create policy "question_assets_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'question-assets' and public.is_admin());

create policy "question_assets_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'question-assets' and public.is_admin())
  with check (bucket_id = 'question-assets' and public.is_admin());

create policy "question_assets_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'question-assets' and public.is_admin());
