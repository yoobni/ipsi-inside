-- ============================================================================
-- 조교 업무 대시보드 + 관리 필요 학생 자동 감지
--
-- 조교가 메뉴를 돌아다니지 않고 "오늘 처리할 것"을 한 화면에서 본다:
--   일지 미작성 · 과제 미체크 · 오늘 마킹 안 함 · 미답변 Q&A · 관리 필요 학생.
-- 관리 필요는 규칙 6개(원장이 임계값 조정)로 자동 감지하고, 조교가 "상담했음"으로
-- 일정 기간 숨길 수 있다(risk_acknowledgements). 매일 스냅샷을 남겨 추이를 본다.
--
-- 지표 정의는 student_stats / top3_boards 와 같다(출석 지각 0.5, 과제 (O+△)/도래,
-- 시험 = 시트별 최고 응시). 두 RPC 모두 SECURITY DEFINER + 호출자 범위
-- (staff_can_access_student)로 거른다 — 조교는 담당 학생만.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 규칙 · 조치 · 스냅샷
-- ---------------------------------------------------------------------------
create table public.risk_rules (
  key text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  threshold numeric not null,
  lookback_days int not null,
  position int not null default 0,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger tr_risk_rules_touch before update on public.risk_rules
  for each row execute function public.touch_updated_at();

insert into public.risk_rules (key, label, description, threshold, lookback_days, position) values
  ('journal_streak',  '일지 연속 미작성', '출석한 날 기준으로 N일 연속 학습일지를 쓰지 않음', 3, 14, 0),
  ('homework_streak', '과제 연속 미이행', '도래한 플래너 과제가 연속 N개 미체크 또는 X', 5, 21, 1),
  ('test_drop',       '시험 점수 급락',   '최근 시트 점수율이 직전 3개 시트 평균보다 N%p 이상 하락', 15, 180, 2),
  ('planner_drop',    '플래너 이행률 급락', '이번 주 수행률이 최근 4주 평균보다 N%p 이상 하락(도래 3개↑)', 30, 35, 3),
  ('inactive',        '장기 미활동',      'N일 동안 일지·플래너 체크·질문·시험 제출이 전혀 없음', 7, 60, 4),
  ('absent_streak',   '연속 결석',        '마지막 마킹 N일이 모두 결석', 2, 30, 5);

-- 조치 기록 — "상담했음, until 까지 숨김". until 지나면 조건이 남아 있을 때 다시 뜬다.
create table public.risk_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  rule_key text not null references public.risk_rules(key) on delete cascade,
  acked_by uuid references public.profiles(id) on delete set null,
  note text,
  until date not null,
  created_at timestamptz not null default now()
);
create index risk_acks_student_idx on public.risk_acknowledgements (student_id, rule_key, until desc);

-- 일별 스냅샷(크론) — 추이·"오늘 새로 뜬 것" 판별용
create table public.risk_snapshots (
  snapshot_date date not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  flags jsonb not null,
  primary key (snapshot_date, student_id)
);
create index risk_snapshots_student_idx on public.risk_snapshots (student_id, snapshot_date desc);

alter table public.risk_rules enable row level security;
alter table public.risk_acknowledgements enable row level security;
alter table public.risk_snapshots enable row level security;

-- 규칙: 교직원 읽기, 원장만 쓰기
create policy "risk_rules_staff_read" on public.risk_rules for select to authenticated
  using ((select public.is_admin()));
create policy "risk_rules_owner_write" on public.risk_rules for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
-- 조치: 담당 학생에 대해 교직원이 읽고 쓴다
create policy "risk_acks_staff_all" on public.risk_acknowledgements for all to authenticated
  using ((select public.is_owner()) or public.staff_can_access_student(student_id))
  with check ((select public.is_owner()) or public.staff_can_access_student(student_id));
-- 스냅샷: 담당 학생 읽기. 쓰기는 service_role(크론)만.
create policy "risk_snapshots_staff_read" on public.risk_snapshots for select to authenticated
  using ((select public.is_owner()) or public.staff_can_access_student(student_id));

-- ---------------------------------------------------------------------------
-- 2. student_risk_flags — 규칙 평가
--    p_student_ids 가 null 이면 호출자가 볼 수 있는 승인 학생 전부.
--    조치(ack)로 숨긴 규칙은 뺀다. p_include_acked = true 면 포함(크론 스냅샷용).
-- ---------------------------------------------------------------------------
create or replace function public.student_risk_flags(
  p_student_ids uuid[] default null,
  p_include_acked boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with d as (
  select (now() at time zone 'Asia/Seoul')::date as today,
         date_trunc('week', (now() at time zone 'Asia/Seoul')::date)::date as week_start
),
r as (select key, label, threshold, lookback_days from public.risk_rules where enabled),
students as (
  select p.id, p.full_name, p.created_at
  from public.profiles p
  where p.role = 'student' and p.status = 'approved'
    and (p_student_ids is null or p.id = any (p_student_ids))
    -- 크론(service_role, auth.uid() 없음)은 전체. 그 외엔 호출자 범위.
    and (
      public.staff_can_access_student(p.id)
      or coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb->>'role' = 'service_role'
    )
),
-- 규칙 1: 출석한 날 기준 연속 일지 미작성
journal_streak as (
  select s.id as student_id, r.label, r.threshold,
    (
      -- 가장 최근 출석일부터 거꾸로, 일지가 없는 날이 몇 개 연속인지
      select count(*) from (
        select da.date, exists (select 1 from public.study_journals j where j.student_id = s.id and j.journal_date = da.date) as wrote,
               row_number() over (order by da.date desc) as rn
        from public.daily_attendance da, d
        where da.student_id = s.id and da.attendance in ('present','late')
          and da.date > d.today - r.lookback_days and da.date <= d.today
      ) x
      where not wrote
        and not exists (select 1 from (
              select da2.date, row_number() over (order by da2.date desc) as rn2
              from public.daily_attendance da2, d
              where da2.student_id = s.id and da2.attendance in ('present','late')
                and da2.date > d.today - r.lookback_days and da2.date <= d.today
            ) y where y.rn2 < x.rn
              and exists (select 1 from public.study_journals j where j.student_id = s.id and j.journal_date = y.date))
    ) as streak
  from students s cross join r where r.key = 'journal_streak'
),
-- 규칙 2: 도래 과제 연속 미이행(미체크 또는 X), 최신부터
homework_streak as (
  select s.id as student_id, r.label, r.threshold,
    (
      select count(*) from (
        select (w.week_start + b.day_of_week) as task_date, tk.position, c.status,
               row_number() over (order by (w.week_start + b.day_of_week) desc, b.start_min desc, tk.position desc) as rn
        from public.planner_weeks w
        join public.planner_blocks b on b.week_id = w.id and b.kind = 'korean'
        join public.planner_tasks tk on tk.block_id = b.id
        left join public.planner_task_checks c on c.task_id = tk.id
        cross join d
        where w.student_id = s.id and w.status = 'published'
          and (w.week_start + b.day_of_week) <= d.today
          and (w.week_start + b.day_of_week) > d.today - r.lookback_days
      ) x
      where (x.status is null or x.status = 'missed')
        and not exists (select 1 from (
              select c2.status, row_number() over (order by (w2.week_start + b2.day_of_week) desc, b2.start_min desc, tk2.position desc) as rn2
              from public.planner_weeks w2
              join public.planner_blocks b2 on b2.week_id = w2.id and b2.kind = 'korean'
              join public.planner_tasks tk2 on tk2.block_id = b2.id
              left join public.planner_task_checks c2 on c2.task_id = tk2.id
              cross join d
              where w2.student_id = s.id and w2.status = 'published'
                and (w2.week_start + b2.day_of_week) <= d.today
                and (w2.week_start + b2.day_of_week) > d.today - r.lookback_days
            ) y where y.rn2 < x.rn and y.status in ('done','late'))
    ) as streak
  from students s cross join r where r.key = 'homework_streak'
),
-- 규칙 3: 시험 급락 — 최근 시트 최고 점수율 vs 직전 3시트 평균
best_sheets as (
  select distinct on (asg.student_id, asg.test_sheet_id)
    asg.student_id, asg.test_sheet_id, t.submitted_at,
    round(100.0 * t.score / t.total_points) as pct
  from public.test_assignments asg
  join public.test_attempts t on t.assignment_id = asg.id and t.status = 'submitted' and coalesce(t.total_points,0) > 0
  cross join d
  where asg.student_id in (select id from students)
    and (t.submitted_at at time zone 'Asia/Seoul')::date > d.today - (select lookback_days from r where key = 'test_drop')
  order by asg.student_id, asg.test_sheet_id, (t.score::numeric / t.total_points) desc, t.submitted_at desc
),
test_drop as (
  select s.id as student_id, r.label, r.threshold, x.latest_pct, x.prev_avg
  from students s cross join r
  join lateral (
    select
      (select pct from best_sheets b where b.student_id = s.id order by submitted_at desc limit 1) as latest_pct,
      (select round(avg(pct)) from (select pct from best_sheets b where b.student_id = s.id order by submitted_at desc offset 1 limit 3) p) as prev_avg
  ) x on true
  where r.key = 'test_drop'
),
-- 규칙 4: 플래너 이행률 급락 — 이번 주 vs 최근 4주 평균(도래 3개↑인 주만)
week_rates as (
  select w.student_id, w.week_start,
         count(*) filter (where (w.week_start + b.day_of_week) <= d.today) as due,
         count(*) filter (where c.status in ('done','late') and (w.week_start + b.day_of_week) <= d.today) as hit
  from public.planner_weeks w
  join public.planner_blocks b on b.week_id = w.id and b.kind = 'korean'
  join public.planner_tasks tk on tk.block_id = b.id
  left join public.planner_task_checks c on c.task_id = tk.id
  cross join d
  where w.student_id in (select id from students) and w.status = 'published'
    and w.week_start >= d.week_start - 28
  group by w.student_id, w.week_start
),
planner_drop as (
  select s.id as student_id, r.label, r.threshold, x.this_rate, x.prev_avg
  from students s cross join r cross join d
  join lateral (
    select
      (select round(100.0 * hit / due) from week_rates wr where wr.student_id = s.id and wr.week_start = d.week_start and wr.due >= 3) as this_rate,
      (select round(avg(100.0 * hit / due)) from week_rates wr where wr.student_id = s.id and wr.week_start < d.week_start and wr.due >= 3) as prev_avg
  ) x on true
  where r.key = 'planner_drop'
),
-- 규칙 5: 장기 미활동 — 마지막 활동일
inactive as (
  select s.id as student_id, r.label, r.threshold, d.today - x.last_active as idle_days
  from students s cross join r cross join d
  join lateral (
    select greatest(
      coalesce((select max(j.journal_date) from public.study_journals j where j.student_id = s.id), '1970-01-01'::date),
      coalesce((select max(c.task_date) from public.planner_task_checks c where c.student_id = s.id), '1970-01-01'::date),
      coalesce((select max((q.created_at at time zone 'Asia/Seoul')::date) from public.qna_questions q where q.student_id = s.id), '1970-01-01'::date),
      coalesce((select max((t.submitted_at at time zone 'Asia/Seoul')::date) from public.test_attempts t join public.test_assignments a on a.id = t.assignment_id where a.student_id = s.id and t.status = 'submitted'), '1970-01-01'::date),
      (s.created_at at time zone 'Asia/Seoul')::date
    ) as last_active
  ) x on true
  where r.key = 'inactive'
),
-- 규칙 6: 연속 결석 — 마지막 마킹부터 거꾸로
absent_streak as (
  select s.id as student_id, r.label, r.threshold,
    (
      select count(*) from (
        select da.attendance, row_number() over (order by da.date desc) as rn
        from public.daily_attendance da, d
        where da.student_id = s.id and da.attendance is not null
          and da.date > d.today - r.lookback_days and da.date <= d.today
      ) x
      where x.attendance = 'absent'
        and not exists (select 1 from (
              select da2.attendance, row_number() over (order by da2.date desc) as rn2
              from public.daily_attendance da2, d
              where da2.student_id = s.id and da2.attendance is not null
                and da2.date > d.today - r.lookback_days and da2.date <= d.today
            ) y where y.rn2 < x.rn and y.attendance <> 'absent')
    ) as streak
  from students s cross join r where r.key = 'absent_streak'
),
flags as (
  select student_id, 'journal_streak' as key, label, ('출석일 기준 ' || streak || '일 연속') as detail
    from journal_streak where streak >= threshold
  union all
  select student_id, 'homework_streak', label, ('과제 ' || streak || '개 연속')
    from homework_streak where streak >= threshold
  union all
  select student_id, 'test_drop', label, ('최근 ' || latest_pct || '% · 이전 평균 ' || prev_avg || '%')
    from test_drop where latest_pct is not null and prev_avg is not null and prev_avg - latest_pct >= threshold
  union all
  select student_id, 'planner_drop', label, ('이번 주 ' || this_rate || '% · 최근 4주 평균 ' || prev_avg || '%')
    from planner_drop where this_rate is not null and prev_avg is not null and prev_avg - this_rate >= threshold
  union all
  select student_id, 'inactive', label, (idle_days || '일째 활동 없음')
    from inactive where idle_days >= threshold
  union all
  select student_id, 'absent_streak', label, (streak || '회 연속 결석')
    from absent_streak where streak >= threshold
),
visible as (
  select f.* from flags f, d
  where p_include_acked
     or not exists (
       select 1 from public.risk_acknowledgements a
       where a.student_id = f.student_id and a.rule_key = f.key and a.until >= d.today
     )
)
select coalesce((
  select jsonb_agg(jsonb_build_object(
    'student_id', s.id,
    'full_name', s.full_name,
    'flags', (select jsonb_agg(jsonb_build_object('key', v.key, 'label', v.label, 'detail', v.detail) order by v.key)
              from visible v where v.student_id = s.id)
  ) order by s.full_name)
  from students s
  where exists (select 1 from visible v where v.student_id = s.id)
), '[]'::jsonb)
$$;

revoke all on function public.student_risk_flags(uuid[], boolean) from public, anon;
grant execute on function public.student_risk_flags(uuid[], boolean) to authenticated;
comment on function public.student_risk_flags(uuid[], boolean) is
  '관리 필요 학생 감지(risk_rules). 호출자 범위의 승인 학생만. ack로 숨긴 규칙 제외.';

-- ---------------------------------------------------------------------------
-- 3. staff_dashboard — 오늘 처리할 것. 메뉴 권한이 없는 블록은 null.
-- ---------------------------------------------------------------------------
create or replace function public.staff_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with d as (
  select (now() at time zone 'Asia/Seoul')::date as today,
         date_trunc('week', (now() at time zone 'Asia/Seoul')::date)::date as week_start
),
students as (
  select p.id, p.full_name
  from public.profiles p
  where p.role = 'student' and p.status = 'approved' and public.staff_can_access_student(p.id)
),
attended_today as (
  select da.student_id from public.daily_attendance da, d
  where da.date = d.today and da.attendance in ('present','late') and da.student_id in (select id from students)
),
journal_missing as (
  -- 오늘 출석 마킹이 있으면 "출석했는데 미작성", 없으면 전체 기준
  select s.id, s.full_name
  from students s, d
  where not exists (select 1 from public.study_journals j where j.student_id = s.id and j.journal_date = d.today)
    and (
      (exists (select 1 from attended_today) and s.id in (select student_id from attended_today))
      or not exists (select 1 from attended_today)
    )
),
homework_unchecked as (
  select s.id, s.full_name, count(*) as tasks
  from students s
  join public.planner_weeks w on w.student_id = s.id and w.status = 'published'
  join public.planner_blocks b on b.week_id = w.id and b.kind = 'korean'
  join public.planner_tasks tk on tk.block_id = b.id
  left join public.planner_task_checks c on c.task_id = tk.id
  cross join d
  where w.week_start = d.week_start
    and (w.week_start + b.day_of_week) <= d.today
    and c.id is null
  group by s.id, s.full_name
),
unmarked_today as (
  select s.id, s.full_name from students s, d
  where not exists (select 1 from public.daily_attendance da where da.student_id = s.id and da.date = d.today)
),
qna_open as (
  select q.id, q.student_id, s.full_name, q.created_at
  from public.qna_questions q join students s on s.id = q.student_id
  where q.status = 'open'
),
pw_pending as (
  select s.id, s.full_name from students s
  join public.profiles p on p.id = s.id where p.must_change_password
)
select jsonb_build_object(
  'today', (select today from d),
  'student_count', (select count(*) from students),
  'journal_missing', case when public.staff_has_permission('journals') then jsonb_build_object(
      'basis', case when exists (select 1 from attended_today) then 'attendance' else 'all' end,
      'students', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', full_name) order by full_name) from journal_missing), '[]'::jsonb)
    ) end,
  'homework_unchecked', case when public.staff_has_permission('planner') then jsonb_build_object(
      'students', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', full_name, 'tasks', tasks) order by tasks desc, full_name) from homework_unchecked), '[]'::jsonb)
    ) end,
  'unmarked_today', case when public.staff_has_permission('daily') then jsonb_build_object(
      'students', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', full_name) order by full_name) from unmarked_today), '[]'::jsonb)
    ) end,
  'qna_open', case when public.staff_has_permission('qna') then jsonb_build_object(
      'count', (select count(*) from qna_open),
      'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', full_name, 'created_at', created_at) order by created_at) from (select * from qna_open order by created_at limit 10) x), '[]'::jsonb)
    ) end,
  'password_pending', case when public.staff_has_permission('members') then jsonb_build_object(
      'students', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', full_name) order by full_name) from pw_pending), '[]'::jsonb)
    ) end,
  'risk', public.student_risk_flags(null, false)
)
$$;

revoke all on function public.staff_dashboard() from public, anon;
grant execute on function public.staff_dashboard() to authenticated;
comment on function public.staff_dashboard() is
  '조교 업무 현황(오늘). 호출자 범위·권한으로 거른 집계. 권한 없는 블록은 null.';
