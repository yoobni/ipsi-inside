-- ============================================================================
-- 누적 취약점(student_mastery) → 보충 세트 추천(create_practice_set)
--
-- 시험 하나로 끝나지 않고 학생의 시험·훈련 데이터를 유형/작품/개념/영역 축으로
-- 누적한다(180일, 최근 90일 분리 → 추이). 취약 태그가 보이면 그 태그의 문항 중
-- 아직 안 풀었거나 틀린 것으로 **기존 시험 파이프라인**(test_sheets kind='practice'
-- + test_assignments)에 보충 세트를 만들어 준다. 응시·채점·결과 화면·성취도 반영이
-- 전부 기존 코드로 돌아 새 채점 코드가 없다. 결과는 다음 student_mastery 계산에 포함
-- → 순환.
--
-- 둘 다 SECURITY DEFINER + 가드: mastery 는 본인·학부모·담당 교직원, 세트 생성은
-- 승인된 학생 본인(하루 2세트 상한). 교직원이 대신 만들어 주는 건 서버 액션에서
-- ensureStaff 후 service_role 로.
-- ============================================================================

alter table public.test_sheets
  add column kind text not null default 'regular' check (kind in ('regular', 'practice'));
create index test_sheets_kind_idx on public.test_sheets (kind);
comment on column public.test_sheets.kind is 'regular=원장이 만든 시험, practice=취약점 보충 세트(자동 생성)';

create table public.practice_sets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  sheet_id uuid not null unique references public.test_sheets(id) on delete cascade,
  tag_kind text not null check (tag_kind in ('type', 'work', 'concept', 'area')),
  tag_id uuid,
  tag_label text not null,
  created_by text not null check (created_by in ('student', 'staff')),
  created_at timestamptz not null default now()
);
create index practice_sets_student_idx on public.practice_sets (student_id, created_at desc);

alter table public.practice_sets enable row level security;
create policy "practice_sets_self_read" on public.practice_sets for select to authenticated
  using (student_id = auth.uid()
      or exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = practice_sets.student_id));
create policy "practice_sets_staff_read" on public.practice_sets for select to authenticated
  using ((select public.is_owner()) or public.staff_can_access_student(student_id));
-- 쓰기는 RPC(definer)/service_role 만

-- ---------------------------------------------------------------------------
-- student_mastery — 태그 축 누적 정답률. 분자·분모만(비율은 화면).
--   total/correct: 최근 180일, recent_*: 최근 90일. 시험은 시트별 최고 응시(미응답=오답),
--   훈련은 첫 시도. 개념 축은 시험 문항(question_concepts)과 훈련(drill_concepts) 합산.
-- ---------------------------------------------------------------------------
create or replace function public.student_mastery(p_student uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with d as (select (now() at time zone 'Asia/Seoul')::date as today),
allowed as (
  select (
    p_student = auth.uid()
    or exists (select 1 from public.parent_student_links where parent_id = auth.uid() and student_id = p_student)
    or public.staff_can_access_student(p_student)
  ) as ok
),
best as (
  select distinct on (asg.test_sheet_id)
    asg.test_sheet_id, t.id as attempt_id, (t.submitted_at at time zone 'Asia/Seoul')::date as d
  from public.test_attempts t
  join public.test_assignments asg on asg.id = t.assignment_id
  cross join d dd
  where asg.student_id = p_student and t.status = 'submitted' and coalesce(t.total_points, 0) > 0
    and (t.submitted_at at time zone 'Asia/Seoul')::date > dd.today - 180
  order by asg.test_sheet_id, (t.score::numeric / t.total_points) desc, t.submitted_at desc
),
-- 문항 단위 행: (날짜, 정답여부, type_id, work_id, source, question_id)
qrows as (
  select b.d, (sa.is_correct is true) as correct, qq.type_id, p.work_id, p.source_type::text as source, qq.id as question_id
  from best b
  join public.test_sheet_questions tsq on tsq.test_sheet_id = b.test_sheet_id
  join public.questions qq on qq.id = tsq.question_id
  join public.passages p on p.id = qq.passage_id
  left join public.student_answers sa on sa.attempt_id = b.attempt_id and sa.question_id = qq.id
),
-- 훈련 첫 시도 행
drows as (
  select (r.answered_at at time zone 'Asia/Seoul')::date as d, r.correct, dr.work_id, dr.area::text as source, dr.id as drill_id
  from public.drill_attempts a
  join public.drills dr on dr.id = a.drill_id
  join public.drill_item_results r on r.attempt_id = a.id and r.retry_no = 1
  cross join d dd
  where a.student_id = p_student
    and (r.answered_at at time zone 'Asia/Seoul')::date > dd.today - 180
),
by_type as (
  select q.type_id as id, qt.label, qt.area::text as area,
         count(*) total, count(*) filter (where q.correct) correct,
         count(*) filter (where q.d > dd.today - 90) recent_total,
         count(*) filter (where q.correct and q.d > dd.today - 90) recent_correct
  from qrows q join public.question_types qt on qt.id = q.type_id cross join d dd
  group by q.type_id, qt.label, qt.area
),
by_work as (
  select x.work_id as id, w.title as label, w.genre as area,
         count(*) total, count(*) filter (where x.correct) correct,
         count(*) filter (where x.d > dd.today - 90) recent_total,
         count(*) filter (where x.correct and x.d > dd.today - 90) recent_correct
  from (select d, correct, work_id from qrows union all select d, correct, work_id from drows) x
  join public.works w on w.id = x.work_id cross join d dd
  group by x.work_id, w.title, w.genre
),
by_concept as (
  select x.concept_id as id, c.title as label, c.area::text as area,
         count(*) total, count(*) filter (where x.correct) correct,
         count(*) filter (where x.d > dd.today - 90) recent_total,
         count(*) filter (where x.correct and x.d > dd.today - 90) recent_correct
  from (
    select q.d, q.correct, qc.concept_id from qrows q join public.question_concepts qc on qc.question_id = q.question_id
    union all
    select r.d, r.correct, dc.concept_id from drows r join public.drill_concepts dc on dc.drill_id = r.drill_id
  ) x
  join public.concepts c on c.id = x.concept_id cross join d dd
  group by x.concept_id, c.title, c.area
),
by_area as (
  select x.source as id_text,
         count(*) total, count(*) filter (where x.correct) correct,
         count(*) filter (where x.d > dd.today - 90) recent_total,
         count(*) filter (where x.correct and x.d > dd.today - 90) recent_correct
  from (select d, correct, source from qrows union all select d, correct, source from drows where source is not null) x
  cross join d dd
  group by x.source
)
select case when not (select ok from allowed) then null else jsonb_build_object(
  'student_id', p_student,
  'window_days', 180,
  'recent_days', 90,
  'untyped_questions', (select count(*) from qrows where type_id is null),
  'by_type', coalesce((select jsonb_agg(to_jsonb(t) order by t.total desc) from by_type t), '[]'::jsonb),
  'by_work', coalesce((select jsonb_agg(to_jsonb(t) order by t.total desc) from by_work t), '[]'::jsonb),
  'by_concept', coalesce((select jsonb_agg(to_jsonb(t) order by t.total desc) from by_concept t), '[]'::jsonb),
  'by_area', coalesce((select jsonb_agg(jsonb_build_object('id', id_text, 'total', total, 'correct', correct, 'recent_total', recent_total, 'recent_correct', recent_correct) order by total desc) from by_area), '[]'::jsonb)
) end
$$;
revoke all on function public.student_mastery(uuid) from public, anon;
grant execute on function public.student_mastery(uuid) to authenticated;
comment on function public.student_mastery(uuid) is
  '유형/작품/개념/영역별 누적 정답률(180일, 최근 90일 분리). 시험 최고 응시 + 훈련 첫 시도. 본인·학부모·담당 교직원.';

-- ---------------------------------------------------------------------------
-- create_practice_set — 승인된 학생 본인. 태그의 문항 중 "아직 안 풀었거나 틀린" 것
-- 우선, 최근 30일 보충 세트에 들어간 문항 제외, 무작위 p_size 개. 3개 미만이면 거절.
-- 하루 2세트 상한. 생성 주체는 'student'. (교직원 생성은 서버 액션이 service_role 로
-- 같은 규칙을 적용해 만든다 — p_for_student 가 그 경로)
-- ---------------------------------------------------------------------------
create or replace function public.create_practice_set(
  p_tag_kind text, p_tag_id uuid, p_size int default 10, p_for_student uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_by text;
  v_label text;
  v_sheet uuid;
  v_ids uuid[];
  v_n int;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_for_student is not null then
    -- 교직원 대리 생성(service_role 또는 담당 교직원)
    if not (public.staff_can_access_student(p_for_student)
            or coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb->>'role' = 'service_role') then
      raise exception 'forbidden';
    end if;
    v_student := p_for_student; v_by := 'staff';
  else
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'student' and status = 'approved') then
      raise exception 'forbidden';
    end if;
    v_student := auth.uid(); v_by := 'student';
    if (select count(*) from public.practice_sets
        where student_id = v_student and created_by = 'student'
          and (created_at at time zone 'Asia/Seoul')::date = v_today) >= 2 then
      raise exception 'daily limit';
    end if;
  end if;
  if p_tag_kind not in ('type', 'work', 'concept', 'area') then raise exception 'bad tag kind'; end if;
  p_size := greatest(3, least(coalesce(p_size, 10), 20));

  -- 태그 라벨
  v_label := case p_tag_kind
    when 'type' then (select label from public.question_types where id = p_tag_id)
    when 'work' then (select title from public.works where id = p_tag_id)
    when 'concept' then (select title from public.concepts where id = p_tag_id)
    else null end;
  if p_tag_kind = 'area' then
    -- area 는 uuid 가 아니라 passage_source 라벨을 p_tag_id 대신 못 받는다 → 호출 측이
    -- type/work/concept 로 바꿔 부르게 하고, area 는 지원 안 함(명시적으로 거절)
    raise exception 'area not supported';
  end if;
  if v_label is null then raise exception 'tag not found'; end if;

  -- 후보: 태그 문항 - 최근 30일 보충 세트에 들어간 문항. 우선순위: 미응시 → 틀림 → 맞힘
  with tagged as (
    select qq.id
    from public.questions qq
    join public.passages p on p.id = qq.passage_id
    left join public.question_concepts qc on qc.question_id = qq.id
    where (p_tag_kind = 'type' and qq.type_id = p_tag_id)
       or (p_tag_kind = 'work' and p.work_id = p_tag_id)
       or (p_tag_kind = 'concept' and qc.concept_id = p_tag_id)
    group by qq.id
  ),
  recent_practice as (
    select tsq.question_id
    from public.practice_sets ps
    join public.test_sheet_questions tsq on tsq.test_sheet_id = ps.sheet_id
    where ps.student_id = v_student and ps.created_at > now() - interval '30 days'
  ),
  history as (
    select sa.question_id, bool_or(sa.is_correct is true) as ever_correct
    from public.student_answers sa
    join public.test_attempts t on t.id = sa.attempt_id and t.status = 'submitted'
    join public.test_assignments asg on asg.id = t.assignment_id
    where asg.student_id = v_student
    group by sa.question_id
  ),
  ranked as (
    select tg.id,
           case when h.question_id is null then 0 when not h.ever_correct then 1 else 2 end as prio
    from tagged tg
    left join history h on h.question_id = tg.id
    where tg.id not in (select question_id from recent_practice)
  )
  select array_agg(id), count(*) into v_ids, v_n
  from (select id from ranked order by prio, random() limit p_size) x;

  if coalesce(v_n, 0) < 3 then
    raise exception 'not enough questions: %', coalesce(v_n, 0);
  end if;

  insert into public.test_sheets (title, description, kind, allow_retake, max_attempts, created_by)
  values ('[보충] ' || v_label || ' ' || v_n || '문제', '취약 태그 자동 보충 세트', 'practice', true, 3, v_student)
  returning id into v_sheet;

  insert into public.test_sheet_questions (test_sheet_id, question_id, position)
  select v_sheet, id, ordinality from unnest(v_ids) with ordinality as u(id, ordinality);

  insert into public.test_assignments (test_sheet_id, student_id, assigned_by)
  values (v_sheet, v_student, coalesce(auth.uid(), v_student));

  insert into public.practice_sets (student_id, sheet_id, tag_kind, tag_id, tag_label, created_by)
  values (v_student, v_sheet, p_tag_kind, p_tag_id, v_label, v_by);

  return v_sheet;
end;
$$;
revoke all on function public.create_practice_set(text, uuid, int, uuid) from public, anon;
grant execute on function public.create_practice_set(text, uuid, int, uuid) to authenticated;
comment on function public.create_practice_set(text, uuid, int, uuid) is
  '취약 태그 보충 세트 생성(test_sheets kind=practice + 배정). 학생 본인 하루 2세트, 3문항 미만이면 거절.';

-- 보충 세트 시트는 학생이 만든 것이라 created_by 가 학생이다. 교직원이 보는 시험 목록에서
-- 구분할 수 있게 kind 를 쓴다(원장 시험 관리 화면은 regular 만 기본 표시).
