-- ============================================================================
-- 코스·진도 코드리뷰 2차 반영
--  1) 회차 순서 바꾸기를 DB 함수 한 트랜잭션으로 — 세 번 나눠 update 하다 중간에 끊기면 회차가
--     음수 자리에 남고, 다음 이동이 같은 임시 자리에서 충돌했다. 유니크를 지연 검사 제약으로
--     바꿔 함수 안에서 맞바꾼다.
--  2) sync_course_session_assignments() 에 조교 담당 범위 가드 — 범위 밖 학생 배정은 채우지 않는다
-- ============================================================================

drop index if exists public.course_sessions_course_position_uidx;
alter table public.course_sessions
  add constraint course_sessions_course_position_key unique (course_id, position)
  deferrable initially immediate;

create or replace function public.move_course_session(p_session_id uuid, p_dir text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course uuid;
  v_pos int;
  v_other_id uuid;
  v_other_pos int;
begin
  if not public.staff_has_permission('courses') then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  if p_dir not in ('up', 'down') then
    raise exception 'invalid dir' using errcode = '22023';
  end if;

  select course_id, position into v_course, v_pos
  from public.course_sessions where id = p_session_id for update;
  if v_course is null then
    raise exception '회차를 찾을 수 없어요' using errcode = 'P0002';
  end if;

  if p_dir = 'up' then
    select id, position into v_other_id, v_other_pos
    from public.course_sessions
    where course_id = v_course and position < v_pos
    order by position desc limit 1 for update;
  else
    select id, position into v_other_id, v_other_pos
    from public.course_sessions
    where course_id = v_course and position > v_pos
    order by position asc limit 1 for update;
  end if;
  if v_other_id is null then
    return; -- 이미 맨 위/아래
  end if;

  -- 맞바꾸는 동안만 중복 검사를 미루고, 끝나면 바로 검사해 되돌린다
  set constraints public.course_sessions_course_position_key deferred;
  update public.course_sessions set position = v_other_pos where id = p_session_id;
  update public.course_sessions set position = v_pos where id = v_other_id;
  set constraints public.course_sessions_course_position_key immediate;
end;
$$;
revoke all on function public.move_course_session(uuid, text) from public, anon;
grant execute on function public.move_course_session(uuid, text) to authenticated;

-- 담당 범위 안 학생에게만 채운다(원장은 전원). 범위 밖 배부 행은 건드리지 않는다.
create or replace function public.sync_course_session_assignments(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.staff_has_permission('courses') then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;

  insert into public.material_assignments (material_id, student_id, assigned_by)
  select i.material_id, d.student_id, v_uid
  from public.course_session_items i
  join public.course_session_deliveries d on d.session_id = i.session_id
  where i.session_id = p_session_id and i.kind = 'material'
    and public.staff_can_access_student(d.student_id)
  on conflict (material_id, student_id) do nothing;

  insert into public.test_assignments (test_sheet_id, student_id, assigned_by)
  select i.test_sheet_id, d.student_id, v_uid
  from public.course_session_items i
  join public.course_session_deliveries d on d.session_id = i.session_id
  where i.session_id = p_session_id and i.kind = 'test'
    and public.staff_can_access_student(d.student_id)
  on conflict (test_sheet_id, student_id) do nothing;
end;
$$;
