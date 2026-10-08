-- ============================================================================
-- student_stats(p_student) — 학생 학습 리포트용 집계 한 덩어리(jsonb)
--
-- 학생이 "내가 좋아지고 있는지 / 어디가 부족한지" 보게 하려는 것. 화면이 6~8번
-- 왕복하며 180일치 student_answers를 Node로 끌어오는 대신 DB에서 한 번에 센다.
--
-- 비율은 만들지 않는다 — 분자·분모만 주고 화면(plannerRate)이 반올림한다.
-- (planner_week_stats와 같은 규칙: 0/0을 0%로 보여주면 '안 했다'로 읽힌다)
--
-- SECURITY DEFINER인 이유: 영역별 성취도가 passages/questions까지 조인하는데
-- 학부모 세션은 그 테이블을 못 읽는다. 대신 맨 위에서 '본인 / 연결된 학부모 /
-- 교직원'만 통과시키고 아니면 null을 돌려준다(submit_attempt와 같은 패턴).
-- 돌려주는 건 전부 그 학생 한 명의 합계뿐이다.
--
-- 날짜는 전부 KST. 주 = ISO 월요일(planner_weeks.week_start와 동일).
-- ============================================================================
create or replace function public.student_stats(p_student uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
d as (
  select (now() at time zone 'Asia/Seoul')::date as today,
         date_trunc('week', (now() at time zone 'Asia/Seoul')::date)::date as week_start
),
allowed as (
  select (
    p_student = auth.uid()
    or exists (
      select 1 from public.parent_student_links
      where parent_id = auth.uid() and student_id = p_student
    )
    or public.is_admin()
  ) as ok
),

-- 시험: 시트별 최고 응시 1건 (재응시가 있으면 가장 잘 본 것, 동률이면 최신).
-- 시험 추이·영역별 성취도가 같은 집합을 써서 재응시를 이중으로 세지 않는다.
best as (
  select distinct on (a.test_sheet_id)
    a.test_sheet_id,
    t.id                                                as attempt_id,
    t.score,
    t.total_points,
    t.submitted_at,
    (t.submitted_at at time zone 'Asia/Seoul')::date    as d,
    count(*) over (partition by a.test_sheet_id)        as attempts
  from public.test_attempts t
  join public.test_assignments a on a.id = t.assignment_id
  where a.student_id = p_student
    and t.status = 'submitted'
    and t.submitted_at is not null
    and coalesce(t.total_points, 0) > 0
  order by a.test_sheet_id,
           (t.score::numeric / t.total_points) desc,
           t.submitted_at desc
),
tests_recent as (
  select b.*, s.title
  from best b
  join public.test_sheets s on s.id = b.test_sheet_id
  order by b.d desc, b.submitted_at desc
  limit 10
),

-- 최근 8주 (오래된 → 최신)
weeks as (
  select (d.week_start - 7 * g)::date as ws from d, generate_series(7, 0, -1) g
),

-- 과제 수행률: 발행된 플래너의 국어 블록 과제만. due = 오늘까지 도래한 과제.
pl as (
  select
    w.week_start as ws,
    count(*) filter (where (w.week_start + b.day_of_week) <= dd.today)                       as hw_due,
    count(*) filter (where c.status = 'done'   and (w.week_start + b.day_of_week) <= dd.today) as hw_done,
    count(*) filter (where c.status = 'late'   and (w.week_start + b.day_of_week) <= dd.today) as hw_late,
    count(*) filter (where c.status = 'missed' and (w.week_start + b.day_of_week) <= dd.today) as hw_missed
  from public.planner_weeks w
  join public.planner_blocks b on b.week_id = w.id and b.kind = 'korean'
  join public.planner_tasks tk on tk.block_id = b.id
  left join public.planner_task_checks c on c.task_id = tk.id
  cross join d dd
  where w.student_id = p_student
    and w.status = 'published'
    and w.week_start in (select ws from weeks)
  group by w.week_start
),

-- 출석: 원장이 마킹한 날만 분모. class_days = 실제로 온 날(일지 작성률 분모).
att as (
  select
    date_trunc('week', da.date)::date                                 as ws,
    count(*) filter (where da.attendance is not null)                 as att_marked,
    count(*) filter (where da.attendance = 'present')                 as att_present,
    count(*) filter (where da.attendance = 'late')                    as att_late,
    count(*) filter (where da.attendance = 'absent')                  as att_absent,
    count(*) filter (where da.attendance in ('present', 'late'))      as class_days
  from public.daily_attendance da, d
  where da.student_id = p_student
    and da.date >= (select min(ws) from weeks)
    and da.date <= d.today
  group by 1
),

-- 일지: 쓴 날 수 + 그중 출석일에 쓴 날 수
jr as (
  select
    date_trunc('week', j.journal_date)::date as ws,
    count(*) as journal_days,
    count(*) filter (where exists (
      select 1 from public.daily_attendance da
      where da.student_id = p_student
        and da.date = j.journal_date
        and da.attendance in ('present', 'late')
    )) as journal_class_days
  from public.study_journals j, d
  where j.student_id = p_student
    and j.journal_date >= (select min(ws) from weeks)
    and j.journal_date <= d.today
  group by 1
),

-- 월: 전월 + 이번 달(MTD)
months as (
  select date_trunc('month', d.today)::date - interval '1 month' as ms from d
  union all
  select date_trunc('month', d.today)::date from d
),
matt as (
  select
    date_trunc('month', da.date)::date                                as ms,
    count(*) filter (where da.attendance is not null)                 as att_marked,
    count(*) filter (where da.attendance = 'present')                 as att_present,
    count(*) filter (where da.attendance = 'late')                    as att_late,
    count(*) filter (where da.attendance = 'absent')                  as att_absent,
    count(*) filter (where da.attendance in ('present', 'late'))      as class_days
  from public.daily_attendance da, d
  where da.student_id = p_student
    and da.date >= (select min(ms) from months)
    and da.date <= d.today
  group by 1
),
mjr as (
  select
    date_trunc('month', j.journal_date)::date as ms,
    count(*) as journal_days,
    count(*) filter (where exists (
      select 1 from public.daily_attendance da
      where da.student_id = p_student
        and da.date = j.journal_date
        and da.attendance in ('present', 'late')
    )) as journal_class_days
  from public.study_journals j, d
  where j.student_id = p_student
    and j.journal_date >= (select min(ms) from months)
    and j.journal_date <= d.today
  group by 1
),

-- 영역별 성취도: 최고 응시 집합에서 시트의 모든 문항을 분모로(미응답 = 오답).
area_cur as (
  select p.source_type::text as source,
         count(*) as total,
         count(*) filter (where sa.is_correct) as correct
  from best b
  join public.test_sheet_questions tq on tq.test_sheet_id = b.test_sheet_id
  join public.questions q on q.id = tq.question_id
  join public.passages p on p.id = q.passage_id
  left join public.student_answers sa on sa.attempt_id = b.attempt_id and sa.question_id = q.id
  cross join d
  where b.d > d.today - 90
  group by 1
),
area_prev as (
  select p.source_type::text as source,
         count(*) as total,
         count(*) filter (where sa.is_correct) as correct
  from best b
  join public.test_sheet_questions tq on tq.test_sheet_id = b.test_sheet_id
  join public.questions q on q.id = tq.question_id
  join public.passages p on p.id = q.passage_id
  left join public.student_answers sa on sa.attempt_id = b.attempt_id and sa.question_id = q.id
  cross join d
  where b.d > d.today - 180 and b.d <= d.today - 90
  group by 1
)

select case when not (select ok from allowed) then null else jsonb_build_object(
  'student_id', p_student,
  'today',      (select today from d),
  'week_start', (select week_start from d),

  'tests', coalesce((
    select jsonb_agg(jsonb_build_object(
      'sheet_id', test_sheet_id, 'title', title, 'date', d,
      'score', score, 'total', total_points, 'attempts', attempts
    ) order by d, submitted_at)
    from tests_recent
  ), '[]'::jsonb),

  'daily_tests', coalesce((
    select jsonb_agg(jsonb_build_object('date', da.date, 'score', da.test_score) order by da.date)
    from public.daily_attendance da, d
    where da.student_id = p_student
      and da.test_score is not null
      and da.date > d.today - 30
      and da.date <= d.today
  ), '[]'::jsonb),

  'weeks', (
    select jsonb_agg(jsonb_build_object(
      'week_start', w.ws,
      'planner',    pl.ws is not null,
      'hw_due',     coalesce(pl.hw_due, 0),
      'hw_done',    coalesce(pl.hw_done, 0),
      'hw_late',    coalesce(pl.hw_late, 0),
      'hw_missed',  coalesce(pl.hw_missed, 0),
      'att_marked',  coalesce(att.att_marked, 0),
      'att_present', coalesce(att.att_present, 0),
      'att_late',    coalesce(att.att_late, 0),
      'att_absent',  coalesce(att.att_absent, 0),
      'class_days',  coalesce(att.class_days, 0),
      'journal_days',       coalesce(jr.journal_days, 0),
      'journal_class_days', coalesce(jr.journal_class_days, 0),
      -- 그 주에 지난 평일 수(월~금). 지난 주는 5, 이번 주는 오늘까지.
      'weekdays_elapsed', least(5, greatest(0, ((select today from d) - w.ws) + 1))
    ) order by w.ws)
    from weeks w
    left join pl  on pl.ws  = w.ws
    left join att on att.ws = w.ws
    left join jr  on jr.ws  = w.ws
  ),

  'months', (
    select jsonb_agg(jsonb_build_object(
      'month', to_char(m.ms, 'YYYY-MM'),
      'att_marked',  coalesce(matt.att_marked, 0),
      'att_present', coalesce(matt.att_present, 0),
      'att_late',    coalesce(matt.att_late, 0),
      'att_absent',  coalesce(matt.att_absent, 0),
      'class_days',  coalesce(matt.class_days, 0),
      'journal_days',       coalesce(mjr.journal_days, 0),
      'journal_class_days', coalesce(mjr.journal_class_days, 0),
      'weekdays_elapsed', (
        select count(*) from generate_series(
          m.ms::date,
          least((m.ms + interval '1 month' - interval '1 day')::date, (select today from d)),
          interval '1 day'
        ) g where extract(isodow from g) <= 5
      )
    ) order by m.ms)
    from months m
    left join matt on matt.ms = m.ms::date
    left join mjr  on mjr.ms  = m.ms::date
  ),

  'areas', jsonb_build_object(
    'window_days', 90,
    'current', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'total', total, 'correct', correct) order by source)
      from area_cur
    ), '[]'::jsonb),
    'previous', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'total', total, 'correct', correct) order by source)
      from area_prev
    ), '[]'::jsonb)
  )
) end
$$;

revoke all on function public.student_stats(uuid) from public, anon;
grant execute on function public.student_stats(uuid) to authenticated;

comment on function public.student_stats(uuid) is
  '학생 학습 리포트 집계. 본인·연결 학부모·교직원만(아니면 null). 비율은 화면이 계산.';
