-- ============================================================================
-- student_stats / top3_boards 가드를 조교 범위에 맞춘다
--
-- 두 RPC는 권한 분리(20261008020000) 뒤에 만들었는데 교직원 판정을 is_admin()으로
-- 했다. is_admin()은 "승인된 교직원 전체"라, 조교가 RPC를 직접 호출하면 담당이
-- 아닌 학생의 집계(시험·출석·일지)도 받을 수 있었다. RLS는 테이블을 막지만
-- SECURITY DEFINER 함수는 RLS를 안 타므로 함수 안의 가드가 곧 경계다.
--
-- 원장은 staff_can_access_student()가 항상 true라 동작이 같다.
-- ============================================================================

-- student_stats: 가드 한 줄만 바뀐다. 본문은 20261008030000 과 동일.
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
    -- 교직원: 원장 전부, 조교는 담당 학생만
    or public.staff_can_access_student(p_student)
  ) as ok
),
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
weeks as (
  select (d.week_start - 7 * g)::date as ws from d, generate_series(7, 0, -1) g
),
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

comment on function public.student_stats(uuid) is
  '학생 학습 리포트 집계. 본인·연결 학부모·담당 교직원만(아니면 null). 비율은 화면이 계산.';

-- top3_boards: 가드 두 곳만 바뀐다 — (1) 타인 기준 호출은 담당 교직원만,
-- (2) 그룹 미리보기도 담당 그룹만. 본문은 20261008040000 과 동일.
-- (함수 전체를 다시 적는 대신 가드 부분만 바꾼 사본을 둔다)
create or replace function public.top3_boards(
  p_student uuid default null,
  p_group uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := coalesce(p_student, auth.uid());
  v_is_admin boolean := public.is_admin();
  v_set public.ranking_settings%rowtype;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_week date := date_trunc('week', (now() at time zone 'Asia/Seoul')::date)::date;
  v_pool uuid[];
  v_scope_label text;
  v_sheet_id uuid;
  v_sheet_title text;
  v_boards jsonb := '[]'::jsonb;
  v_board jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  -- 남의 랭킹 화면을 대신 보려면 그 학생의 학부모이거나 **담당** 교직원이어야 한다
  if v_me <> auth.uid()
     and not public.staff_can_access_student(v_me)
     and not exists (
       select 1 from public.parent_student_links
       where parent_id = auth.uid() and student_id = v_me
     ) then
    raise exception 'forbidden';
  end if;
  -- 그룹 미리보기는 교직원 전용이고, 조교는 담당 그룹만
  if p_group is not null and not public.staff_can_access_group(p_group) then
    raise exception 'forbidden';
  end if;

  select * into v_set from public.ranking_settings where id = 1;

  if v_is_admin and p_group is not null then
    select array_agg(gm.student_id), max(g.name)
      into v_pool, v_scope_label
    from public.group_members gm
    join public.student_groups g on g.id = gm.group_id
    join public.profiles p on p.id = gm.student_id
    where gm.group_id = p_group and p.role = 'student' and p.status = 'approved';
  elsif v_set.scope = 'group' then
    select array_agg(distinct gm2.student_id), string_agg(distinct g.name, ' · ')
      into v_pool, v_scope_label
    from public.group_members gm
    join public.student_groups g on g.id = gm.group_id and g.archived = false
    join public.group_members gm2 on gm2.group_id = gm.group_id
    join public.profiles p on p.id = gm2.student_id
    where gm.student_id = v_me and p.role = 'student' and p.status = 'approved';
  end if;
  if v_pool is null then
    select array_agg(id) into v_pool
    from public.profiles where role = 'student' and status = 'approved';
    v_scope_label := '학원 전체';
  end if;
  v_pool := coalesce(v_pool, '{}'::uuid[]);

  if v_set.show_homework then
    with rows as (
      select
        w.student_id,
        count(*) filter (where c.status in ('done', 'late'))   as hit,
        count(*)                                               as due,
        count(*) filter (where c.status = 'done')              as done,
        count(*) filter (where c.status = 'late')              as late
      from public.planner_weeks w
      join public.planner_blocks b on b.week_id = w.id and b.kind = 'korean'
      join public.planner_tasks tk on tk.block_id = b.id
      left join public.planner_task_checks c on c.task_id = tk.id
      where w.student_id = any (v_pool)
        and w.status = 'published'
        and w.week_start = v_week
        and (w.week_start + b.day_of_week) <= v_today
      group by w.student_id
      having count(*) >= 3
    ),
    scored as (
      select r.*, p.full_name,
             round(100.0 * r.hit / r.due) as score,
             rank() over (order by (r.hit::numeric / r.due) desc, r.done desc, r.late asc) as rk
      from rows r join public.profiles p on p.id = r.student_id
    )
    select jsonb_build_object(
      'key', 'homework',
      'title', '이번 주 과제 수행 TOP3',
      'period_label', to_char(v_week, 'MM/DD') || ' ~ ' || to_char(v_today, 'MM/DD'),
      'subtitle', case when (select count(*) from rows) = 0
                       then '이번 주 도래한 과제가 3개 이상인 학생이 아직 없어요' end,
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rank', t.rk,
          'name', case when t.student_id = v_me or v_set.name_display = 'full'
                       then t.full_name else public.ranking_mask_name(t.full_name) end,
          'value_label', t.score || '% (' || t.hit || '/' || t.due || ')',
          'is_me', t.student_id = v_me
        ) order by t.rk, t.done desc, t.late asc, t.student_id)
        from (select * from scored order by rk, done desc, late asc, student_id limit 3) t
      ), '[]'::jsonb),
      'me', coalesce(
        (select jsonb_build_object('value_label', s.score || '% (' || s.hit || '/' || s.due || ')', 'qualified', true)
           from scored s where s.student_id = v_me),
        case when v_me = any (v_pool) then jsonb_build_object('value_label', null, 'qualified', false) end
      ),
      'pool_size', (select count(*) from rows)
    ) into v_board;
    v_boards := v_boards || v_board;
  end if;

  if v_set.show_attendance then
    with rows as (
      select
        da.student_id,
        count(*) filter (where da.attendance is not null)             as marked,
        count(*) filter (where da.attendance = 'present')             as present,
        count(*) filter (where da.attendance = 'late')                as late,
        count(*) filter (where da.homework_grade is not null)         as graded,
        avg(case da.homework_grade when 'S' then 4 when 'A' then 3 when 'B' then 2 when 'F' then 0 end) as hw_avg
      from public.daily_attendance da
      where da.student_id = any (v_pool)
        and da.date > v_today - 14 and da.date <= v_today
      group by da.student_id
      having count(*) filter (where da.attendance is not null) >= 3
    ),
    scored as (
      select r.*, p.full_name,
        round(100 * case
          when r.graded > 0 then 0.6 * ((r.present + 0.5 * r.late) / r.marked) + 0.4 * (r.hw_avg / 4.0)
          else (r.present + 0.5 * r.late) / r.marked
        end) as score
      from rows r join public.profiles p on p.id = r.student_id
    ),
    ranked as (
      select s.*, rank() over (order by s.score desc, s.marked desc) as rk from scored s
    )
    select jsonb_build_object(
      'key', 'attendance',
      'title', '출석·성실도 TOP3',
      'period_label', '최근 14일',
      'subtitle', case when (select count(*) from rows) = 0
                       then '최근 14일 마킹이 3일 이상인 학생이 아직 없어요' end,
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rank', t.rk,
          'name', case when t.student_id = v_me or v_set.name_display = 'full'
                       then t.full_name else public.ranking_mask_name(t.full_name) end,
          'value_label', t.score || '점',
          'is_me', t.student_id = v_me
        ) order by t.rk, t.marked desc, t.student_id)
        from (select * from ranked order by rk, marked desc, student_id limit 3) t
      ), '[]'::jsonb),
      'me', coalesce(
        (select jsonb_build_object('value_label', s.score || '점', 'qualified', true)
           from ranked s where s.student_id = v_me),
        case when v_me = any (v_pool) then jsonb_build_object('value_label', null, 'qualified', false) end
      ),
      'pool_size', (select count(*) from rows)
    ) into v_board;
    v_boards := v_boards || v_board;
  end if;

  if v_set.show_growth then
    with rows as (
      select
        da.student_id,
        avg(da.test_score) filter (where da.date > v_today - 14)                       as recent,
        avg(da.test_score) filter (where da.date <= v_today - 14)                      as prior,
        count(*) filter (where da.date > v_today - 14)                                 as n_recent,
        count(*) filter (where da.date <= v_today - 14)                                as n_prior
      from public.daily_attendance da
      where da.student_id = any (v_pool)
        and da.test_score is not null
        and da.date > v_today - 28 and da.date <= v_today
      group by da.student_id
      having count(*) filter (where da.date > v_today - 14) >= 2
         and count(*) filter (where da.date <= v_today - 14) >= 2
    ),
    scored as (
      select r.*, p.full_name, round(r.recent - r.prior, 1) as delta
      from rows r join public.profiles p on p.id = r.student_id
    ),
    ranked as (
      select s.*, rank() over (order by s.delta desc, s.recent desc) as rk from scored s
    )
    select jsonb_build_object(
      'key', 'growth',
      'title', '가장 많이 성장한 TOP3',
      'period_label', '최근 14일 vs 그 전 14일 (일일 테스트)',
      'subtitle', case when (select count(*) from rows) = 0
                       then '두 구간 모두 테스트 점수가 2회 이상인 학생이 아직 없어요' end,
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rank', t.rk,
          'name', case when t.student_id = v_me or v_set.name_display = 'full'
                       then t.full_name else public.ranking_mask_name(t.full_name) end,
          'value_label', (case when t.delta >= 0 then '+' else '' end) || t.delta || '점',
          'is_me', t.student_id = v_me
        ) order by t.rk, t.recent desc, t.student_id)
        from (select * from ranked order by rk, recent desc, student_id limit 3) t
      ), '[]'::jsonb),
      'me', coalesce(
        (select jsonb_build_object('value_label', (case when s.delta >= 0 then '+' else '' end) || s.delta || '점', 'qualified', true)
           from ranked s where s.student_id = v_me),
        case when v_me = any (v_pool) then jsonb_build_object('value_label', null, 'qualified', false) end
      ),
      'pool_size', (select count(*) from rows)
    ) into v_board;
    v_boards := v_boards || v_board;
  end if;

  if v_set.show_test then
    v_sheet_id := v_set.featured_test_sheet_id;
    if v_sheet_id is null then
      select a.test_sheet_id into v_sheet_id
      from public.test_attempts t
      join public.test_assignments a on a.id = t.assignment_id
      where t.status = 'submitted' and a.student_id = any (v_pool)
        and coalesce(t.total_points, 0) > 0
      group by a.test_sheet_id
      having count(distinct a.student_id) >= 3
      order by max(t.submitted_at) desc
      limit 1;
    end if;
    select title into v_sheet_title from public.test_sheets where id = v_sheet_id;

    with best as (
      select distinct on (a.student_id)
        a.student_id, t.score, t.total_points, t.submitted_at,
        (t.score::numeric / t.total_points) as pct
      from public.test_attempts t
      join public.test_assignments a on a.id = t.assignment_id
      where a.test_sheet_id = v_sheet_id
        and a.student_id = any (v_pool)
        and t.status = 'submitted'
        and coalesce(t.total_points, 0) > 0
      order by a.student_id, (t.score::numeric / t.total_points) desc, t.submitted_at asc
    ),
    rows as (
      select * from best where (select count(*) from best) >= 3
    ),
    scored as (
      select r.student_id, r.score as pts, r.total_points, r.submitted_at, p.full_name,
             round(100 * r.pct) as score_pct,
             rank() over (order by r.pct desc, r.submitted_at asc) as rk
      from rows r join public.profiles p on p.id = r.student_id
    )
    select jsonb_build_object(
      'key', 'test',
      'title', '시험 우수 TOP3',
      'period_label', coalesce(v_sheet_title, ''),
      'subtitle', case when (select count(*) from rows) = 0 then '아직 집계할 시험이 없어요' end,
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rank', t.rk,
          'name', case when t.student_id = v_me or v_set.name_display = 'full'
                       then t.full_name else public.ranking_mask_name(t.full_name) end,
          'value_label', t.score_pct || '% (' || t.pts || '/' || t.total_points || ')',
          'is_me', t.student_id = v_me
        ) order by t.rk, t.submitted_at, t.student_id)
        from (select * from scored order by rk, submitted_at, student_id limit 3) t
      ), '[]'::jsonb),
      'me', coalesce(
        (select jsonb_build_object('value_label', s.score_pct || '% (' || s.pts || '/' || s.total_points || ')', 'qualified', true)
           from scored s where s.student_id = v_me),
        case when v_me = any (v_pool) then jsonb_build_object('value_label', null, 'qualified', false) end
      ),
      'pool_size', (select count(*) from rows)
    ) into v_board;
    v_boards := v_boards || v_board;
  end if;

  return jsonb_build_object(
    'settings', jsonb_build_object(
      'name_display', v_set.name_display,
      'scope', v_set.scope,
      'scope_label', v_scope_label
    ),
    'boards', v_boards
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- passages / questions 읽기는 'tests' 권한으로도 — 시험 구성·채점 화면이
-- 세션 클라이언트로 지문·문항을 읽는다(tests/new, tests/[id], attempts/[attemptId]).
-- 'tests'만 받은 조교에게 문항 목록이 비어 보이던 문제. 쓰기는 그대로 'passages'.
-- (question-assets 버킷이 이미 passages OR tests 인 것과 같은 기준)
-- ---------------------------------------------------------------------------
drop policy if exists "passages_admin_all" on public.passages;
create policy "passages_admin_select" on public.passages
  for select to authenticated
  using ((select public.staff_has_permission('passages')) or (select public.staff_has_permission('tests')));
create policy "passages_admin_insert" on public.passages
  for insert to authenticated
  with check ((select public.staff_has_permission('passages')));
create policy "passages_admin_update" on public.passages
  for update to authenticated
  using ((select public.staff_has_permission('passages')))
  with check ((select public.staff_has_permission('passages')));
create policy "passages_admin_delete" on public.passages
  for delete to authenticated
  using ((select public.staff_has_permission('passages')));

drop policy if exists "questions_admin_all" on public.questions;
create policy "questions_admin_select" on public.questions
  for select to authenticated
  using ((select public.staff_has_permission('passages')) or (select public.staff_has_permission('tests')));
create policy "questions_admin_insert" on public.questions
  for insert to authenticated
  with check ((select public.staff_has_permission('passages')));
create policy "questions_admin_update" on public.questions
  for update to authenticated
  using ((select public.staff_has_permission('passages')))
  with check ((select public.staff_has_permission('passages')));
create policy "questions_admin_delete" on public.questions
  for delete to authenticated
  using ((select public.staff_has_permission('passages')));
