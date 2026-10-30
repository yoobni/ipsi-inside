-- ============================================================================
-- 전체 코드리뷰 반영 (2026-10-30)
--  1) 훈련 결과 알림 수신자에 'passages' 권한 조건 — 링크(/drills/attempts)가 그 권한으로 막혀 있어
--     권한 없는 조교는 열 수 없는 알림을 받았다
--  2) save_course_session_items() — 회차 저장(제목·요약·항목 diff)을 한 트랜잭션으로.
--     삭제→항목별 갱신→추가로 나뉘어 돌다 중간에 실패하면 일부만 반영된 채 남던 문제.
--     id 있는 항목은 갱신(숙제 체크 보존), 없으면 추가, 목록에서 빠진 행은 삭제. 저장된 행을 돌려준다.
-- ============================================================================

create or replace function public.share_drill_attempt(p_attempt_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_student uuid;
  v_finished timestamptz;
  v_shared timestamptz;
  v_correct int;
  v_total int;
  v_title text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'student' and p.status = 'approved') then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  if v_note is not null and length(v_note) > 300 then
    raise exception '메모는 300자까지예요' using errcode = '22023';
  end if;

  select a.student_id, a.finished_at, a.shared_at, a.correct, a.total, d.title
    into v_student, v_finished, v_shared, v_correct, v_total, v_title
  from public.drill_attempts a join public.drills d on d.id = a.drill_id
  where a.id = p_attempt_id for update;
  if v_student is null or v_student <> v_uid then
    raise exception '응시 기록을 찾을 수 없어요' using errcode = 'P0002';
  end if;
  if v_finished is null then
    raise exception '훈련을 끝낸 뒤에 보낼 수 있어요' using errcode = '22023';
  end if;
  if v_shared is not null then
    return jsonb_build_object('shared_at', v_shared, 'already', true);
  end if;

  update public.drill_attempts set shared_at = now(), share_note = v_note where id = p_attempt_id
  returning shared_at into v_shared;

  -- 수신자: 원장 전원 + 이 학생이 담당 범위이고 **'passages' 권한이 있는** 조교(결과 화면이 그 권한으로 열림)
  insert into public.notifications (user_id, type, title, body, link)
  select s.id, 'drill_shared',
         '학생이 훈련 결과를 보냈어요',
         v_title || ' · ' || coalesce(v_correct, 0) || '/' || coalesce(v_total, 0) || case when v_note is null then '' else ' · 메모 있음' end,
         '/drills/attempts/' || p_attempt_id
  from public.profiles s
  where s.role = 'admin' and s.status = 'approved'
    and (
      s.admin_level = 'owner'
      or exists (
        select 1 from public.staff_settings ss
        where ss.staff_id = s.id
          and 'passages' = any (ss.permissions)
          and (
            ss.scope_mode = 'all'
            or exists (select 1 from public.staff_student_scope x where x.staff_id = s.id and x.student_id = v_uid)
            or exists (select 1 from public.staff_group_scope g
                       join public.group_members gm on gm.group_id = g.group_id
                       where g.staff_id = s.id and gm.student_id = v_uid)
          )
      )
    );

  return jsonb_build_object('shared_at', v_shared, 'already', false);
end;
$$;

-- p_items: [{id?, kind, ref?, title?, due_days?}, ...]  순서 = 배열 순서.
-- ref = material_id | test_sheet_id | drill_id | guide_id (kind 에 따라). 참조 가시성 검증은 호출 측(세션)에서.
create or replace function public.save_course_session_items(
  p_session_id uuid,
  p_title text,
  p_summary text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep uuid[] := '{}';
  v_it jsonb;
  v_pos int := 0;
  v_id uuid;
  v_kind text;
  v_ref uuid;
begin
  if not public.staff_has_permission('courses') then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid items' using errcode = '22023';
  end if;

  update public.course_sessions set title = p_title, summary = nullif(btrim(coalesce(p_summary, '')), '')
  where id = p_session_id;
  if not found then
    raise exception '회차를 찾을 수 없어요' using errcode = 'P0002';
  end if;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_pos := v_pos + 1;
    v_kind := v_it->>'kind';
    v_ref := nullif(v_it->>'ref', '')::uuid;
    v_id := nullif(v_it->>'id', '')::uuid;
    if v_kind not in ('material', 'test', 'drill', 'guide', 'homework') then
      raise exception 'invalid kind' using errcode = '22023';
    end if;

    -- 이 회차에 실제 있는 id 만 갱신(다른 회차 행 id 를 끼워 넣어도 무시). 한 번 쓴 id 는 재사용 불가.
    if v_id is not null and v_id = any (v_keep) then
      v_id := null;
    end if;
    if v_id is not null and not exists (select 1 from public.course_session_items where id = v_id and session_id = p_session_id) then
      v_id := null;
    end if;

    if v_id is not null then
      update public.course_session_items set
        position = v_pos,
        kind = v_kind,
        material_id = case when v_kind = 'material' then v_ref end,
        test_sheet_id = case when v_kind = 'test' then v_ref end,
        drill_id = case when v_kind = 'drill' then v_ref end,
        guide_id = case when v_kind = 'guide' then v_ref end,
        title = case when v_kind = 'homework' then v_it->>'title' end,
        due_days = case when v_kind = 'homework' then (v_it->>'due_days')::int end
      where id = v_id;
    else
      insert into public.course_session_items (session_id, position, kind, material_id, test_sheet_id, drill_id, guide_id, title, due_days)
      values (
        p_session_id, v_pos, v_kind,
        case when v_kind = 'material' then v_ref end,
        case when v_kind = 'test' then v_ref end,
        case when v_kind = 'drill' then v_ref end,
        case when v_kind = 'guide' then v_ref end,
        case when v_kind = 'homework' then v_it->>'title' end,
        case when v_kind = 'homework' then (v_it->>'due_days')::int end
      )
      returning id into v_id;
    end if;
    v_keep := v_keep || v_id;
  end loop;

  delete from public.course_session_items where session_id = p_session_id and not (id = any (v_keep));

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'kind', i.kind, 'material_id', i.material_id, 'test_sheet_id', i.test_sheet_id,
      'drill_id', i.drill_id, 'guide_id', i.guide_id, 'title', i.title, 'due_days', i.due_days
    ) order by i.position), '[]'::jsonb)
    from public.course_session_items i where i.session_id = p_session_id
  );
end;
$$;
revoke all on function public.save_course_session_items(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_course_session_items(uuid, text, text, jsonb) to authenticated;
