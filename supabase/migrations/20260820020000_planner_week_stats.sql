-- ============================================================================
-- planner_week_stats(week_id) — 주간 이행 통계 한 번에 집계
--
-- security invoker(기본)로 둔다. 내부 조인이 전부 RLS를 타므로 원장은 전체,
-- 학생·학부모는 본인/자녀의 발행된 주차만 집계된다. 보이지 않는 주차를
-- 넘기면 행이 0개 → 스칼라 null 이 돌아간다(권한 판단을 함수가 하지 않음).
--
-- 비율은 계산하지 않고 분자·분모만 돌려준다. 반올림 지점을 화면이 정하게 하고
-- jsonb 안에 float를 넣지 않기 위함.
--
-- 'due'는 KST 오늘까지 도래한 과제. 미래 과제를 미입력으로 세면 발행 직후
-- 이행률이 0%로 보이므로 미입력은 반드시 due 기준으로 센다.
-- ============================================================================
create or replace function public.planner_week_stats(p_week_id uuid)
returns jsonb
language sql
stable
as $$
with wk as (
  select id, student_id, week_start, status
  from public.planner_weeks
  where id = p_week_id
),
t as (
  select
    tk.id                            as task_id,
    tk.title,
    tk.tag_id,
    b.day_of_week,
    b.end_min,
    (w.week_start + b.day_of_week)   as task_date,
    c.status,
    c.late_reason,
    c.checked_at,
    c.photo_path,
    -- 체크 시각이 그 블록 종료시각을 넘겼는지 (벼락치기 판별)
    case
      when c.checked_at is null then null
      else (c.checked_at at time zone 'Asia/Seoul')
             <= ((w.week_start + b.day_of_week)::timestamp
                  + make_interval(mins => b.end_min))
    end                              as on_time
  from wk w
  join public.planner_blocks b
    on b.week_id = w.id and b.kind = 'korean'
  join public.planner_tasks tk
    on tk.block_id = b.id
  left join public.planner_task_checks c
    on c.task_id = tk.id
),
d as (select (now() at time zone 'Asia/Seoul')::date as today)
select jsonb_build_object(
  'week_id',    w.id,
  'student_id', w.student_id,
  'week_start', w.week_start,
  'status',     w.status,

  'total',   (select count(*) from t),
  'due',     (select count(*) from t, d where t.task_date <= d.today),
  'checked', (select count(*) from t where t.status is not null),
  'done',    (select count(*) from t where t.status = 'done'),
  'late',    (select count(*) from t where t.status = 'late'),
  'missed',  (select count(*) from t where t.status = 'missed'),
  'unchecked_due',
    (select count(*) from t, d where t.task_date <= d.today and t.status is null),

  -- 시간 준수 — 수행한 과제(O/△) 중 블록 종료시각 이내에 체크한 비율의 분자/분모
  'on_time',
    (select count(*) from t where t.status in ('done','late') and t.on_time),
  'on_time_base',
    (select count(*) from t where t.status in ('done','late') and t.on_time is not null),

  'photo_count', (select count(*) from t where t.photo_path is not null),

  'by_tag', coalesce((
    select jsonb_agg(x order by x->>'name')
    from (
      select jsonb_build_object(
        'tag_id', t.tag_id,
        'name',   coalesce(g.name, '태그 없음'),
        'color',  g.color,
        'total',  count(*),
        'done',   count(*) filter (where t.status = 'done'),
        'late',   count(*) filter (where t.status = 'late'),
        'missed', count(*) filter (where t.status = 'missed'),
        'unchecked_due', count(*) filter (
          where t.status is null
            and t.task_date <= (select today from d)
        )
      ) as x
      from t
      left join public.planner_tags g on g.id = t.tag_id
      group by t.tag_id, g.name, g.color
    ) s
  ), '[]'::jsonb),

  'by_day', coalesce((
    select jsonb_agg(x order by (x->>'day_of_week')::int)
    from (
      select jsonb_build_object(
        'day_of_week', t.day_of_week,
        'date',   t.task_date,
        'total',  count(*),
        'done',   count(*) filter (where t.status = 'done'),
        'late',   count(*) filter (where t.status = 'late'),
        'missed', count(*) filter (where t.status = 'missed'),
        'unchecked', count(*) filter (where t.status is null)
      ) as x
      from t
      group by t.day_of_week, t.task_date
    ) s
  ), '[]'::jsonb),

  -- △ 사유 모아보기 (상담용)
  'late_reasons', coalesce((
    select jsonb_agg(x order by x->>'date', x->>'title')
    from (
      select jsonb_build_object(
        'date',  t.task_date,
        'title', t.title,
        'reason', t.late_reason
      ) as x
      from t
      where t.status = 'late' and t.late_reason is not null
    ) s
  ), '[]'::jsonb),

  -- X 목록 (상담용)
  'missed_items', coalesce((
    select jsonb_agg(x order by x->>'date', x->>'title')
    from (
      select jsonb_build_object('date', t.task_date, 'title', t.title) as x
      from t
      where t.status = 'missed'
    ) s
  ), '[]'::jsonb)
)
from wk w;
$$;

comment on function public.planner_week_stats(uuid) is
  '주간 플래너 이행 통계. 비율 없이 분자/분모만. RLS invoker — 보이지 않는 주차는 null.';
