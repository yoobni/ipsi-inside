-- ============================================================================
-- 코스(커리큘럼) · 회차 · 수업 진행 처리 → 회차 묶음 자동 배부
--
-- 원장이 코스(예: "독서의 속도")를 만들고 회차(1주차, 2주차 …)마다 복습지(자료)·퀴즈(시험지)·
-- OX 훈련·학습 가이드·숙제(체크 항목)를 미리 담아 둔다. 반(student_groups)에 코스를 연결해 두고,
-- 수업을 마치면 "○반 1주차 진행"으로 그날 들은 학생을 체크해 한 번에 배부한다.
--
-- 배부 = course_session_deliveries 한 행(회차×학생). 이 행이 생기는 순간
--   · 자료 → material_assignments, 시험지 → test_assignments (기존 배정 경로 재사용, 스냅샷)
--   · 훈련·가이드 → 발행분은 원래 전체 공개라 따로 열 것 없음(강의실에서 링크로 묶어 보여줌)
--   · 숙제 → 학생이 course_homework_checks 로 완료 체크
--   · 알림(학생 + 연결된 학부모) — **새로 배부된 학생에게만**(재처리 중복 알림 없음)
-- 를 deliver_course_session() 한 트랜잭션에서 한다. 조교가 자료·시험 권한 없이 'courses'
-- 권한만으로 배부할 수 있게 definer 로 두고, 안에서 권한·담당 범위를 직접 검사한다.
--
-- 중간 합류생은 지난 회차를 자동으로 받지 않는다(배부는 명시 행위). 필요하면 같은 RPC로
-- 개별 보강 배부(kind='makeup').
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 권한 키 'courses' — packages/types/src/staff.ts STAFF_PERMISSIONS 와 같이 움직인다
-- ---------------------------------------------------------------------------
alter table public.staff_settings drop constraint if exists staff_settings_permissions_check;
alter table public.staff_settings add constraint staff_settings_permissions_check
  check (permissions <@ array[
    'members','groups','passages','tests','materials','planner',
    'journals','daily','announcements','columns','qna','courses'
  ]::text[]);

-- ---------------------------------------------------------------------------
-- 2. 테이블
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  description text,
  archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tr_courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();

-- 반 ↔ 코스 (한 반이 여러 코스를 들을 수 있다)
create table public.course_groups (
  course_id uuid not null references public.courses(id) on delete cascade,
  group_id uuid not null references public.student_groups(id) on delete cascade,
  primary key (course_id, group_id)
);
create index course_groups_group_idx on public.course_groups (group_id);

create table public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null,
  title text not null check (length(btrim(title)) > 0),
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index course_sessions_course_idx on public.course_sessions (course_id, position);
create trigger tr_course_sessions_touch before update on public.course_sessions
  for each row execute function public.touch_updated_at();

-- 회차에 담는 것. kind 별로 정확히 하나의 참조(숙제는 title)만 채운다.
-- 원본(자료·시험지 등)을 지우면 항목도 같이 사라진다 — 이미 배부된 배정 행은 원본 쪽 cascade 를 따른다.
create table public.course_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.course_sessions(id) on delete cascade,
  position int not null,
  kind text not null check (kind in ('material', 'test', 'drill', 'guide', 'homework')),
  material_id uuid references public.materials(id) on delete cascade,
  test_sheet_id uuid references public.test_sheets(id) on delete cascade,
  drill_id uuid references public.drills(id) on delete cascade,
  guide_id uuid references public.guides(id) on delete cascade,
  -- 숙제 문구. 다른 kind 에선 null.
  title text,
  -- 숙제 마감 = 배부일(KST) + due_days 일. null 이면 마감 없음.
  due_days int check (due_days between 0 and 60),
  created_at timestamptz not null default now(),
  constraint course_session_items_ref check (
    case kind
      when 'material' then material_id is not null and test_sheet_id is null and drill_id is null and guide_id is null and title is null
      when 'test'     then test_sheet_id is not null and material_id is null and drill_id is null and guide_id is null and title is null
      when 'drill'    then drill_id is not null and material_id is null and test_sheet_id is null and guide_id is null and title is null
      when 'guide'    then guide_id is not null and material_id is null and test_sheet_id is null and drill_id is null and title is null
      when 'homework' then title is not null and length(btrim(title)) > 0
                           and material_id is null and test_sheet_id is null and drill_id is null and guide_id is null
    end
  ),
  constraint course_session_items_due_homework check (due_days is null or kind = 'homework')
);
create index course_session_items_session_idx on public.course_session_items (session_id, position);

-- 배부 = 회차×학생 1행. 쓰기는 deliver_course_session() 만(정책 없음).
create table public.course_session_deliveries (
  session_id uuid not null references public.course_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'regular' check (kind in ('regular', 'makeup')),
  delivered_by uuid references public.profiles(id) on delete set null,
  delivered_at timestamptz not null default now(),
  primary key (session_id, student_id)
);
create index course_session_deliveries_student_idx on public.course_session_deliveries (student_id, delivered_at desc);

create table public.course_homework_checks (
  item_id uuid not null references public.course_session_items(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (item_id, student_id)
);
create index course_homework_checks_student_idx on public.course_homework_checks (student_id);

alter table public.courses enable row level security;
alter table public.course_groups enable row level security;
alter table public.course_sessions enable row level security;
alter table public.course_session_items enable row level security;
alter table public.course_session_deliveries enable row level security;
alter table public.course_homework_checks enable row level security;

-- ---------------------------------------------------------------------------
-- 3. RLS
--   콘텐츠(코스·회차·항목·반 연결): 'courses' 권한 교직원이 쓰기/읽기.
--   학생·학부모: **배부받은 회차**와 그 코스·항목만 읽는다(안 열린 회차는 제목도 안 보임).
-- ---------------------------------------------------------------------------
create policy "courses_staff_all" on public.courses for all to authenticated
  using ((select public.staff_has_permission('courses')))
  with check ((select public.staff_has_permission('courses')));
create policy "course_groups_staff_all" on public.course_groups for all to authenticated
  using ((select public.staff_has_permission('courses')))
  with check ((select public.staff_has_permission('courses')));
create policy "course_sessions_staff_all" on public.course_sessions for all to authenticated
  using ((select public.staff_has_permission('courses')))
  with check ((select public.staff_has_permission('courses')));
create policy "course_session_items_staff_all" on public.course_session_items for all to authenticated
  using ((select public.staff_has_permission('courses')))
  with check ((select public.staff_has_permission('courses')));

-- 본인 또는 연결된 자녀에게 배부된 회차인가
create or replace function public.course_session_visible(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.course_session_deliveries d
    where d.session_id = p_session_id
      and (
        d.student_id = auth.uid()
        or exists (
          select 1 from public.parent_student_links psl
          where psl.parent_id = auth.uid() and psl.student_id = d.student_id
        )
      )
  )
$$;
revoke all on function public.course_session_visible(uuid) from public, anon;
grant execute on function public.course_session_visible(uuid) to authenticated;

create policy "course_sessions_delivered_read" on public.course_sessions for select to authenticated
  using (public.course_session_visible(id));
create policy "course_session_items_delivered_read" on public.course_session_items for select to authenticated
  using (public.course_session_visible(session_id));
create policy "courses_delivered_read" on public.courses for select to authenticated
  using (exists (
    select 1 from public.course_sessions s
    where s.course_id = courses.id and public.course_session_visible(s.id)
  ));

create policy "course_deliveries_self_read" on public.course_session_deliveries for select to authenticated
  using (student_id = auth.uid()
      or exists (select 1 from public.parent_student_links psl
                 where psl.parent_id = auth.uid() and psl.student_id = course_session_deliveries.student_id));
create policy "course_deliveries_staff_read" on public.course_session_deliveries for select to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('courses')) and public.staff_can_access_student(student_id)));

-- 숙제 체크: 학생 본인만, 자기에게 배부된 회차의 숙제 항목에만
create policy "course_homework_self_insert" on public.course_homework_checks for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'approved')
    and exists (
      select 1 from public.course_session_items i
      join public.course_session_deliveries d on d.session_id = i.session_id and d.student_id = auth.uid()
      where i.id = course_homework_checks.item_id and i.kind = 'homework'
    )
  );
create policy "course_homework_self_delete" on public.course_homework_checks for delete to authenticated
  using (student_id = auth.uid());
create policy "course_homework_self_read" on public.course_homework_checks for select to authenticated
  using (student_id = auth.uid()
      or exists (select 1 from public.parent_student_links psl
                 where psl.parent_id = auth.uid() and psl.student_id = course_homework_checks.student_id));
create policy "course_homework_staff_read" on public.course_homework_checks for select to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('courses')) and public.staff_can_access_student(student_id)));

-- ---------------------------------------------------------------------------
-- 4. 배부 RPC — 권한·범위 검사 → 배부 행 → 자료·시험 배정 → 알림, 한 트랜잭션.
--    이미 받은 학생은 건너뛴다(멱등). 돌려주는 값 = 이번에 새로 배부된 학생 수.
-- ---------------------------------------------------------------------------
create or replace function public.deliver_course_session(
  p_session_id uuid,
  p_student_ids uuid[],
  p_kind text default 'regular'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_course_title text;
  v_session_title text;
  v_new uuid[];
begin
  if not public.staff_has_permission('courses') then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  if p_kind not in ('regular', 'makeup') then
    raise exception 'invalid kind' using errcode = '22023';
  end if;
  if coalesce(array_length(p_student_ids, 1), 0) = 0 then
    return 0;
  end if;
  if array_length(p_student_ids, 1) > 500 then
    raise exception '한 번에 500명까지 배부할 수 있어요' using errcode = '22023';
  end if;

  select c.title, s.title into v_course_title, v_session_title
  from public.course_sessions s join public.courses c on c.id = s.course_id
  where s.id = p_session_id;
  if v_session_title is null then
    raise exception '회차를 찾을 수 없어요' using errcode = 'P0002';
  end if;

  -- 조교 범위 밖 학생이 하나라도 섞이면 통째로 거절(일부만 조용히 빠지면 원장이 모른다)
  if exists (
    select 1 from unnest(p_student_ids) sid
    where not public.staff_can_access_student(sid)
  ) then
    raise exception '담당 범위 밖 학생이 포함되어 있어요' using errcode = '42501';
  end if;

  -- 승인된 학생만, 이번에 처음 받는 학생만
  with ins as (
    insert into public.course_session_deliveries (session_id, student_id, kind, delivered_by)
    select p_session_id, p.id, p_kind, v_uid
    from public.profiles p
    where p.id = any (p_student_ids) and p.role = 'student' and p.status = 'approved'
    on conflict (session_id, student_id) do nothing
    returning student_id
  )
  select coalesce(array_agg(student_id), '{}') into v_new from ins;

  if coalesce(array_length(v_new, 1), 0) = 0 then
    return 0;
  end if;

  insert into public.material_assignments (material_id, student_id, assigned_by)
  select i.material_id, sid, v_uid
  from public.course_session_items i, unnest(v_new) sid
  where i.session_id = p_session_id and i.kind = 'material'
  on conflict (material_id, student_id) do nothing;

  insert into public.test_assignments (test_sheet_id, student_id, assigned_by)
  select i.test_sheet_id, sid, v_uid
  from public.course_session_items i, unnest(v_new) sid
  where i.session_id = p_session_id and i.kind = 'test'
  on conflict (test_sheet_id, student_id) do nothing;

  -- 알림 제목에 실명을 넣지 않는다(탈퇴 후에도 수신자 행으로 남음)
  insert into public.notifications (user_id, type, title, body, link)
  select sid, 'course_session', '새 수업이 열렸어요: ' || v_session_title, v_course_title, '/dashboard/class'
  from unnest(v_new) sid;

  insert into public.notifications (user_id, type, title, body, link)
  select distinct psl.parent_id, 'course_session', '자녀의 새 수업이 열렸어요', v_course_title || ' · ' || v_session_title, '/dashboard/class'
  from public.parent_student_links psl
  where psl.student_id = any (v_new);

  return array_length(v_new, 1);
end;
$$;
revoke all on function public.deliver_course_session(uuid, uuid[], text) from public, anon;
grant execute on function public.deliver_course_session(uuid, uuid[], text) to authenticated;
