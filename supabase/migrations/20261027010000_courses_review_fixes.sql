-- ============================================================================
-- 코스·진도 코드리뷰 반영
--  1) 회차 position 유니크 — 같은 번호 회차가 둘 생기면 위/아래 이동이 조용히 안 먹는다
--  2) sync_course_session_assignments() — 배부 뒤 회차에 추가한 자료·퀴즈는 배정 행이 없어
--     이미 받은 학생에게 영원히 "준비 중"이었다. 회차 저장·배부 때 빠진 배정만 채운다(알림 없음)
--  3) deliver_course_session() — 새로 받은/이미 받은/배부 불가(미승인 등)를 구분해 돌려주고,
--     학부모 알림 링크에 ?child= 를 붙인다(자녀 둘이면 첫째 강의실로만 가던 문제)
-- ============================================================================

create unique index if not exists course_sessions_course_position_uidx
  on public.course_sessions (course_id, position);

-- 이 회차를 받은 학생 전원에 대해 빠진 자료·시험 배정을 채운다. 멱등, 알림 없음.
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
  on conflict (material_id, student_id) do nothing;

  insert into public.test_assignments (test_sheet_id, student_id, assigned_by)
  select i.test_sheet_id, d.student_id, v_uid
  from public.course_session_items i
  join public.course_session_deliveries d on d.session_id = i.session_id
  where i.session_id = p_session_id and i.kind = 'test'
  on conflict (test_sheet_id, student_id) do nothing;
end;
$$;
revoke all on function public.sync_course_session_assignments(uuid) from public, anon;
grant execute on function public.sync_course_session_assignments(uuid) to authenticated;

-- 반환형이 바뀌므로 drop 후 재생성
drop function if exists public.deliver_course_session(uuid, uuid[], text);

create or replace function public.deliver_course_session(
  p_session_id uuid,
  p_student_ids uuid[],
  p_kind text default 'regular'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_course_title text;
  v_session_title text;
  v_ids uuid[];
  v_new uuid[];
  v_already int;
begin
  if not public.staff_has_permission('courses') then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  if p_kind not in ('regular', 'makeup') then
    raise exception 'invalid kind' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct sid), '{}') into v_ids from unnest(p_student_ids) sid;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return jsonb_build_object('delivered', 0, 'already', 0, 'ineligible', 0);
  end if;
  if array_length(v_ids, 1) > 500 then
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
    select 1 from unnest(v_ids) sid
    where not public.staff_can_access_student(sid)
  ) then
    raise exception '담당 범위 밖 학생이 포함되어 있어요' using errcode = '42501';
  end if;

  select count(*) into v_already
  from public.course_session_deliveries d
  where d.session_id = p_session_id and d.student_id = any (v_ids);

  -- 승인된 학생만, 이번에 처음 받는 학생만
  with ins as (
    insert into public.course_session_deliveries (session_id, student_id, kind, delivered_by)
    select p_session_id, p.id, p_kind, v_uid
    from public.profiles p
    where p.id = any (v_ids) and p.role = 'student' and p.status = 'approved'
    on conflict (session_id, student_id) do nothing
    returning student_id
  )
  select coalesce(array_agg(student_id), '{}') into v_new from ins;

  -- 자료·시험 배정 — 이미 받은 학생의 빠진 배정(배부 뒤 추가된 항목)도 여기서 같이 채워진다
  perform public.sync_course_session_assignments(p_session_id);

  if coalesce(array_length(v_new, 1), 0) > 0 then
    -- 알림은 새로 받은 학생에게만. 제목에 실명을 넣지 않는다(탈퇴 후에도 수신자 행으로 남음)
    insert into public.notifications (user_id, type, title, body, link)
    select sid, 'course_session', '새 수업이 열렸어요: ' || v_session_title, v_course_title, '/dashboard/class'
    from unnest(v_new) sid;

    insert into public.notifications (user_id, type, title, body, link)
    select psl.parent_id, 'course_session', '자녀의 새 수업이 열렸어요',
           v_course_title || ' · ' || v_session_title, '/dashboard/class?child=' || psl.student_id
    from public.parent_student_links psl
    where psl.student_id = any (v_new);
  end if;

  return jsonb_build_object(
    'delivered', coalesce(array_length(v_new, 1), 0),
    'already', v_already,
    'ineligible', array_length(v_ids, 1) - v_already - coalesce(array_length(v_new, 1), 0)
  );
end;
$$;
revoke all on function public.deliver_course_session(uuid, uuid[], text) from public, anon;
grant execute on function public.deliver_course_session(uuid, uuid[], text) to authenticated;
