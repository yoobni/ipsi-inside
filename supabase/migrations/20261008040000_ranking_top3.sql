-- ============================================================================
-- TOP3 랭킹 — 긍정적 자극만. 1등~꼴등 공개는 하지 않는다.
--
-- 보드 4개: 이번 주 과제 수행 / 출석·성실도(14일) / 가장 많이 성장(일일 테스트
-- 14일 vs 이전 14일) / 시험 우수(지정 시트 또는 제출자 3명 이상인 최신 시트).
-- 단순 성적 순위보다 성실도·성장도를 같이 쓴다.
--
-- 이름 표시(실명/마스킹)와 집계 범위(학원 전체/같은 반)는 원장 설정(ranking_settings).
-- 학생은 이 테이블을 못 읽는다 — SECURITY DEFINER인 top3_boards()가 읽어서
-- 결과에만 반영한다.
--
-- top3_boards()가 돌려주는 것: 보드별 상위 3명의 (순위, 표시 이름, 값 라벨, 나인지)
-- 와 내 값(순위 아님). id·4위 이하·"내 순위 12/13" 같은 건 넣지 않는다 —
-- 다른 학생 행을 한 명분이라도 식별 가능하게 돌려주면 안 되고, 하위권 순위는
-- 자극이 아니라 낙인이다.
--
-- 지표 정의는 student_stats(학습 리포트)와 같다: 출석률 = (출석+0.5×지각)/마킹,
-- 과제 수행률 = (O+△)/도래, 시험 = 학생별 최고 응시. 두 화면의 숫자가 어긋나면
-- 학생이 둘 다 못 믿는다.
-- ============================================================================

create table public.ranking_settings (
  id int primary key default 1 check (id = 1),
  name_display text not null default 'masked' check (name_display in ('masked', 'full')),
  scope text not null default 'all' check (scope in ('all', 'group')),
  show_homework boolean not null default true,
  show_attendance boolean not null default true,
  show_growth boolean not null default true,
  show_test boolean not null default true,
  featured_test_sheet_id uuid references public.test_sheets(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger tr_ranking_settings_touch
  before update on public.ranking_settings
  for each row execute function public.touch_updated_at();

insert into public.ranking_settings (id) values (1);

-- 실명 공개 여부는 개인정보 설정이라 원장만. 학생 select 정책 없음.
alter table public.ranking_settings enable row level security;
create policy "ranking_settings_owner_all" on public.ranking_settings
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

comment on table public.ranking_settings is
  'TOP3 랭킹 설정(싱글턴 id=1). 이름 표시·범위·보드 on/off·지정 시험. 원장만 쓰고 읽음.';

-- 김수→김○, 김철수→김○수, 남궁민수→남○○수
create or replace function public.ranking_mask_name(p_name text)
returns text
language sql
immutable
as $$
  select case
    when p_name is null or length(p_name) = 0 then ''
    when length(p_name) = 1 then p_name
    when length(p_name) = 2 then left(p_name, 1) || '○'
    else left(p_name, 1) || repeat('○', length(p_name) - 2) || right(p_name, 1)
  end
$$;

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
  -- 남의 랭킹 화면을 대신 보려면 그 학생의 학부모이거나 교직원이어야 한다
  if v_me <> auth.uid() and not v_is_admin and not exists (
    select 1 from public.parent_student_links
    where parent_id = auth.uid() and student_id = v_me
  ) then
    raise exception 'forbidden';
  end if;

  select * into v_set from public.ranking_settings where id = 1;

  -- 집계 풀
  if v_is_admin and p_group is not null then
    -- 원장 미리보기: 특정 그룹
    select array_agg(gm.student_id), max(g.name)
      into v_pool, v_scope_label
    from public.group_members gm
    join public.student_groups g on g.id = gm.group_id
    join public.profiles p on p.id = gm.student_id
    where gm.group_id = p_group and p.role = 'student' and p.status = 'approved';
  elsif v_set.scope = 'group' then
    -- 나와 비보관 그룹을 하나라도 공유하는 학생(합집합)
    select array_agg(distinct gm2.student_id), string_agg(distinct g.name, ' · ')
      into v_pool, v_scope_label
    from public.group_members gm
    join public.student_groups g on g.id = gm.group_id and g.archived = false
    join public.group_members gm2 on gm2.group_id = gm.group_id
    join public.profiles p on p.id = gm2.student_id
    where gm.student_id = v_me and p.role = 'student' and p.status = 'approved';
  end if;
  if v_pool is null then
    -- 전체(또는 그룹 없는 학생의 fallback)
    select array_agg(id) into v_pool
    from public.profiles where role = 'student' and status = 'approved';
    v_scope_label := '학원 전체';
  end if;
  v_pool := coalesce(v_pool, '{}'::uuid[]);

  -- ── 보드 1: 이번 주 과제 수행 ──────────────────────────────────────────────
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

  -- ── 보드 2: 출석·성실도 (14일) ─────────────────────────────────────────────
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

  -- ── 보드 3: 가장 많이 성장 (일일 테스트 14일 vs 이전 14일) ─────────────────
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

  -- ── 보드 4: 시험 우수 (지정 시트, 없으면 제출자 3명 이상인 최신 시트) ─────
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
      -- 제출자 3명 미만이면 보드를 비운다(1~2명이면 사실상 전체 공개)
      select * from best where (select count(*) from best) >= 3
    ),
    scored as (
      -- pts = 득점, score_pct = 점수율(%)
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

revoke all on function public.top3_boards(uuid, uuid) from public, anon;
grant execute on function public.top3_boards(uuid, uuid) to authenticated;

comment on function public.top3_boards(uuid, uuid) is
  'TOP3 보드. 본인(또는 자녀·교직원 미리보기) 기준 풀에서 상위 3명만. id·하위 순위 없음.';
