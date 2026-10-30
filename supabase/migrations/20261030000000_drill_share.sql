-- ============================================================================
-- 훈련 결과를 선생님에게 보내기
--
-- 학생이 훈련을 마친 뒤 "쌤에게 결과 보내기"(메모 선택)를 누르면 그 응시 행에 shared_at·share_note 가
-- 찍히고, 원장과 **그 학생을 담당하는 조교**에게 알림이 간다. 교직원은 결과 상세(틀린 항목·메모)를 보고
-- "확인"을 눌러 share_ack 를 남긴다. 둘 다 definer RPC 로만 쓴다 — 학생은 drill_attempts 에 쓰기 정책이 없고
-- (점수 위조 방지), 교직원 확인은 ack 컬럼만 바꿔야 하므로.
-- 알림 제목·본문에 실명은 넣지 않는다(탈퇴 후에도 수신자 행으로 남음) — 상세 화면에서 이름을 본다.
-- ============================================================================

alter table public.drill_attempts
  add column shared_at timestamptz,
  add column share_note text check (share_note is null or length(share_note) <= 300),
  add column share_ack_by uuid references public.profiles(id) on delete set null,
  add column share_ack_at timestamptz;
create index drill_attempts_shared_idx on public.drill_attempts (shared_at desc) where shared_at is not null;

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
  -- 이미 보냈으면 그대로(두 번 눌러도 알림이 또 가지 않게)
  if v_shared is not null then
    return jsonb_build_object('shared_at', v_shared, 'already', true);
  end if;

  update public.drill_attempts set shared_at = now(), share_note = v_note where id = p_attempt_id
  returning shared_at into v_shared;

  -- 수신자: 원장 전원 + 이 학생이 담당 범위인 조교(전체 담당이거나, 학생/그룹 지정에 포함)
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
revoke all on function public.share_drill_attempt(uuid, text) from public, anon;
grant execute on function public.share_drill_attempt(uuid, text) to authenticated;

-- 교직원 확인 표시 — 담당 범위 학생의 보낸 결과만. 이미 확인했으면 그대로 둔다(처음 확인한 사람 기록).
create or replace function public.ack_drill_share(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
begin
  select student_id into v_student from public.drill_attempts where id = p_attempt_id and shared_at is not null;
  if v_student is null then
    raise exception '보낸 결과를 찾을 수 없어요' using errcode = 'P0002';
  end if;
  if not public.staff_has_permission('passages') or not public.staff_can_access_student(v_student) then
    raise exception '권한이 없어요' using errcode = '42501';
  end if;
  update public.drill_attempts set share_ack_by = auth.uid(), share_ack_at = now()
  where id = p_attempt_id and share_ack_at is null;
end;
$$;
revoke all on function public.ack_drill_share(uuid) from public, anon;
grant execute on function public.ack_drill_share(uuid) to authenticated;
