-- ============================================================================
-- planner_week_stats 수정 — 태그별·요일별에도 '도래(due)' 기준을 적용
--
-- 20260820020000 에서 상단 합계만 due를 썼고 by_tag·by_day는 전체 과제를
-- 셌다. 그래서 아직 오지 않은 토요일 과제가 태그별 분모에 들어가고
-- (도래 3건인데 영역별 합계 4건), 도래 0건인 주차의 영역별이 0%로 떴다.
-- 0%는 '안 했다'는 뜻이라 상담 자료로 쓰면 사실과 다르게 읽힌다.
--
-- 비율은 여전히 만들지 않는다 — 분자·분모만 주고 화면이 반올림한다.
--   by_tag.due  : 그 태그 과제 중 오늘까지 도래한 수 (이행률 분모)
--   by_day.due  : 그 요일이 이미 도래했는지 (미도래는 화면에서 회색 처리)
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
        -- 이행률 분모 — 미도래 과제를 넣으면 배정 직후 0%로 보인다
        'due',    count(*) filter (where t.task_date <= (select today from d)),
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
        -- 아직 오지 않은 요일은 화면에서 회색 처리한다 ("토 0/1"이
        -- 상담 자료에서 '안 했다'로 읽히지 않게)
        'due',    (t.task_date <= (select today from d)),
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
