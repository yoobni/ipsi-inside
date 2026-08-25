-- ============================================================================
-- 보안 전수조사(docs/security-review-2026-08-25.md) 수정 — H-1, H-2, M-2
-- ============================================================================

-- ---------------------------------------------------------------------------
-- H-1. 학생이 자기 시험 점수를 직접 고칠 수 있었다
--
-- test_attempts_student_rw 가 `for all`이라, 본인 attempt이기만 하면 어떤 컬럼이든
-- 쓸 수 있었다. 점수는 DB가 아니라 제출 액션이 계산해 넣는 값이라 지키는 장치가
-- 없었다. 브라우저엔 anon key와 본인 JWT가 이미 있으므로
--   PATCH /rest/v1/test_attempts?id=eq.<내 attempt>  {"score":100}
-- 한 줄이면 학부모 리포트까지 조작된 점수가 올라간다.
--
-- 고치는 방향: 점수를 쓰는 일은 학생 손에서 완전히 뺀다.
--   - 제출은 SECURITY DEFINER 함수가 소유 확인 → 계산 → 기록까지 원자적으로 한다
--   - 학생에게는 SELECT와 (응시 시작) INSERT만 남긴다
--   - 답안은 아직 제출 전(in_progress)일 때만 쓸 수 있다
-- ---------------------------------------------------------------------------

create or replace function public.submit_attempt(p_attempt_id uuid)
returns table (score int, total_points int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status text;
  v_earned int;
  v_total int;
begin
  select asg.student_id, ta.status
    into v_owner, v_status
    from public.test_attempts ta
    join public.test_assignments asg on asg.id = ta.assignment_id
   where ta.id = p_attempt_id;

  if v_owner is null then
    raise exception '응시 기록을 찾을 수 없습니다';
  end if;

  -- SECURITY DEFINER라 RLS를 우회한다. 소유 확인을 여기서 직접 해야 한다.
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception '본인의 응시가 아닙니다';
  end if;

  -- 이미 제출된 건 그대로 둔다(재제출로 점수가 바뀌면 안 된다).
  -- 네트워크 재시도로 두 번 불릴 수 있으니 오류 대신 현재 값을 돌려준다.
  if v_status <> 'in_progress' then
    return query
      select ta.score, ta.total_points
        from public.test_attempts ta
       where ta.id = p_attempt_id;
    return;
  end if;

  select s.earned_points, s.total_points
    into v_earned, v_total
    from public.attempt_total_score(p_attempt_id) s;

  update public.test_attempts ta
     set status = 'submitted',
         submitted_at = now(),
         score = coalesce(v_earned, 0),
         total_points = coalesce(v_total, 0)
   where ta.id = p_attempt_id;

  return query select coalesce(v_earned, 0), coalesce(v_total, 0);
end;
$$;

revoke all on function public.submit_attempt(uuid) from public, anon;
grant execute on function public.submit_attempt(uuid) to authenticated;

-- 학생 정책 재구성: 읽기 + 응시 시작만
drop policy if exists "test_attempts_student_rw" on public.test_attempts;

create policy "test_attempts_student_select"
  on public.test_attempts for select
  to authenticated
  using (
    exists (
      select 1 from public.test_assignments asg
       where asg.id = test_attempts.assignment_id
         and asg.student_id = auth.uid()
    )
  );

create policy "test_attempts_student_insert"
  on public.test_attempts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.test_assignments asg
       where asg.id = test_attempts.assignment_id
         and asg.student_id = auth.uid()
    )
  );
-- UPDATE 정책은 일부러 없다. 제출은 submit_attempt()만 한다.

-- 이중 방어: 정책이 실수로 되살아나도 점수 컬럼은 손대지 못하게 한다.
-- 관리자 화면은 이 테이블을 delete만 하므로(재응시 초기화) 영향이 없다.
revoke update (score, total_points, status, submitted_at)
  on public.test_attempts from authenticated;

-- 답안: 읽기는 언제나, 쓰기는 제출 전에만
drop policy if exists "student_answers_student_rw" on public.student_answers;

create policy "student_answers_student_select"
  on public.student_answers for select
  to authenticated
  using (
    exists (
      select 1 from public.test_attempts ta
        join public.test_assignments asg on asg.id = ta.assignment_id
       where ta.id = student_answers.attempt_id
         and asg.student_id = auth.uid()
    )
  );

create policy "student_answers_student_write"
  on public.student_answers for all
  to authenticated
  using (
    exists (
      select 1 from public.test_attempts ta
        join public.test_assignments asg on asg.id = ta.assignment_id
       where ta.id = student_answers.attempt_id
         and asg.student_id = auth.uid()
         and ta.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1 from public.test_attempts ta
        join public.test_assignments asg on asg.id = ta.assignment_id
       where ta.id = student_answers.attempt_id
         and asg.student_id = auth.uid()
         and ta.status = 'in_progress'
    )
  );

-- ---------------------------------------------------------------------------
-- H-2. profiles UPDATE 정책이 무한 재귀 — 본인 정보 수정이 아예 안 됐다
--
-- role/status를 지키려고 with_check 안에서 profiles를 다시 select 했다.
-- RLS 평가 중 같은 테이블에 재진입해 PostgreSQL이 재귀로 판정한다:
--   ERROR: infinite recursion detected in policy for relation "profiles"
--
-- 재귀만 없애면 이번엔 must_change_password 자가 해제와 동의 시각 조작이 열린다
-- (지금은 재귀 덕분에 우연히 막혀 있었다). 그래서 정책은 소유 확인만 하고,
-- **쓸 수 있는 컬럼 자체를 권한으로 못 박는다.** 정책 표현식보다 확실하고,
-- 나중에 컬럼이 늘어도 기본이 '못 씀'이라 안전한 쪽으로 실패한다.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_update_self_basic" on public.profiles;

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (full_name, phone, school, grade)
  on public.profiles to authenticated;
-- role·status·must_change_password·동의 시각·approved_* 는 service_role만 쓴다.
-- (관리자 화면의 승인/정지, 탈퇴 마스킹, 비밀번호 잠금 해제가 전부 service_role이다)

-- ---------------------------------------------------------------------------
-- M-2. question-assets 버킷에 크기·타입 제한이 없었다
--
-- 업로드 코드가 5MB·이미지만 받도록 검증하고 있지만 버킷 자체엔 제한이 없어,
-- 관리자 계정이 털리면 공개 URL로 아무 파일이나 호스팅할 수 있었다.
-- public을 끄지 않는 이유: 이 URL이 지문 HTML(TipTap) 본문에 <img src>로 박혀 있어
-- private로 바꾸면 기존 지문의 이미지가 전부 깨진다. 제한을 걸어 위험만 줄인다.
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp']
 where id = 'question-assets';
