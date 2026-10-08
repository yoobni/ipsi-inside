-- ============================================================================
-- 원장(owner) / 조교(assistant) 권한 분리
--
-- 지금까지는 is_admin() 하나가 "모든 메뉴 + 모든 학생"을 뜻했다. 조교에게
-- 운영을 맡기려면 (1) 허용된 메뉴만, (2) 담당 학생·그룹만 닿게 해야 한다.
--
-- 설계:
--   - 둘 다 profiles.role='admin' 그대로. 급은 profiles.admin_level(owner|assistant).
--     role 값을 새로 만들면 웹(학생 앱)의 "role='admin'이면 차단"과 notifications
--     정책이 조교를 학생 앱에 들여보낸다. 기존 원장 계정은 백필로 owner가 된다.
--   - is_admin()은 **재정의하지 않는다** — "승인된 교직원 전체"라는 뜻으로 남긴다.
--     그래서 이 마이그레이션이 깨뜨리는 기존 동작이 없고, 아래에서 테이블별로
--     정책을 좁히는 것만 추가 작업이다.
--   - 조교 설정은 staff_settings(권한 배열 + 범위 모드) / staff_student_scope /
--     staff_group_scope. 조교는 자기 행을 읽기만 한다(쓰기 정책 없음 → 자기 승격 불가).
--   - 범위 모드는 명시 플래그. scoped + 지정 0명 = 아무도 못 본다(실패 시 닫힘).
--     "지정이 없으면 전체"로 두면 마지막 지정을 지우는 순간 전체 개인정보가 열린다.
--
-- 정책 표현식은 `(select public.is_owner())` 꼴로 쓴다 — 상관 없는 서브쿼리라
-- 문장당 1번만 평가된다(initplan). 원장은 행마다 함수 호출 없이 바로 통과한다.
-- 조교만 행 단위로 staff_can_access_student(student_id)를 탄다.
--
-- 원장 전용(조교에게 부여 불가): 가입 승인(parent_signup_requests·pending 프로필),
-- 접속기록, 동의 증적, profiles 쓰기, 학부모 연결, 조교 관리.
-- CSV 반출·임시비번·정지는 DB 정책이 아니라 앱(ensureOwner)에서 막는다 — 전부
-- service_role 경로라 RLS가 안 보는 곳이다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. profiles.admin_level
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column admin_level text
  check (admin_level in ('owner', 'assistant'));

-- 기존 관리자 전원 = 원장. (제약을 걸기 전에 채운다)
update public.profiles set admin_level = 'owner' where role = 'admin';

-- role과 급이 어긋나지 못하게. admin ⇔ admin_level not null.
alter table public.profiles
  add constraint profiles_admin_level_matches_role
  check ((role = 'admin') = (admin_level is not null));

create index profiles_admin_level_idx
  on public.profiles (admin_level) where role = 'admin';

comment on column public.profiles.admin_level is
  '관리자 급. owner=원장(전권), assistant=조교(staff_settings로 제한). 학생·학부모는 null. '
  'authenticated의 컬럼 UPDATE 권한에 넣지 않는다 — 조교가 스스로 owner가 되면 안 된다.';

-- ---------------------------------------------------------------------------
-- 1. 조교 설정 테이블
-- ---------------------------------------------------------------------------
create table public.staff_settings (
  staff_id uuid primary key references public.profiles(id) on delete cascade,
  -- 메뉴 권한 키. packages/types/src/staff.ts STAFF_PERMISSIONS 와 같이 움직인다.
  permissions text[] not null default '{}'
    check (permissions <@ array[
      'members','groups','passages','tests','materials','planner',
      'journals','daily','announcements','columns','qna'
    ]::text[]),
  scope_mode text not null default 'scoped' check (scope_mode in ('all', 'scoped')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger tr_staff_settings_touch
  before update on public.staff_settings
  for each row execute function public.touch_updated_at();

create table public.staff_student_scope (
  staff_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (staff_id, student_id)
);
create index staff_student_scope_student_idx on public.staff_student_scope (student_id);

create table public.staff_group_scope (
  staff_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.student_groups(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (staff_id, group_id)
);
create index staff_group_scope_group_idx on public.staff_group_scope (group_id);

comment on table public.staff_settings is
  '조교별 메뉴 권한·학생 범위 모드. 원장만 쓴다. 행이 없는 조교 = 권한 0, scoped.';
comment on column public.staff_settings.scope_mode is
  'all=전체 학생, scoped=staff_student_scope ∪ staff_group_scope 멤버만. scoped+0명=아무도 못 봄.';

-- ---------------------------------------------------------------------------
-- 2. 헬퍼 — 전부 SECURITY DEFINER sql stable. profiles 정책 안에서 profiles를
--    다시 읽어도 재귀하지 않는 건 is_admin()과 같은 원리(definer가 RLS를 안 탐).
-- ---------------------------------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
      and admin_level = 'owner'
  )
$$;

create or replace function public.is_assistant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
      and admin_level = 'assistant'
  )
$$;

-- 메뉴 권한. 원장은 항상 true.
create or replace function public.staff_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner()
      or (
        public.is_assistant()
        and exists (
          select 1 from public.staff_settings ss
          where ss.staff_id = auth.uid()
            and p_permission = any (ss.permissions)
        )
      )
$$;

-- 이 학생이 내 담당인가. 원장은 항상 true.
-- 조교 분기에서 대상은 '관리자가 아닌, 승인/정지 상태' 계정으로 한정한다 —
-- pending/rejected(가입 승인 대기)는 원장만의 데이터이고, 다른 교직원 행을
-- 조교가 열거해서도 안 된다.
create or replace function public.staff_can_access_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner()
      or (
        public.is_assistant()
        and exists (
          select 1 from public.profiles t
          where t.id = p_student_id
            and t.role <> 'admin'
            and t.status in ('approved', 'suspended')
        )
        and exists (
          select 1 from public.staff_settings ss
          where ss.staff_id = auth.uid()
            and (
              ss.scope_mode = 'all'
              or exists (
                select 1 from public.staff_student_scope s
                where s.staff_id = auth.uid() and s.student_id = p_student_id
              )
              or exists (
                select 1
                from public.staff_group_scope g
                join public.group_members gm on gm.group_id = g.group_id
                where g.staff_id = auth.uid() and gm.student_id = p_student_id
              )
            )
        )
      )
$$;

-- 프로필 단위 — 학생 본인이거나, 담당 학생에 연결된 학부모.
create or replace function public.staff_can_access_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_can_access_student(p_profile_id)
      or exists (
        select 1 from public.parent_student_links psl
        where psl.parent_id = p_profile_id
          and public.staff_can_access_student(psl.student_id)
      )
$$;

-- 그룹 단위 — 그룹 수정/삭제·멤버 관리용. 원장은 항상 true.
create or replace function public.staff_can_access_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner()
      or (
        public.is_assistant()
        and exists (
          select 1 from public.staff_settings ss
          where ss.staff_id = auth.uid()
            and (
              ss.scope_mode = 'all'
              or exists (
                select 1 from public.staff_group_scope g
                where g.staff_id = auth.uid() and g.group_id = p_group_id
              )
            )
        )
      )
$$;

-- 조교 설정 테이블 RLS — 원장 전권, 조교는 본인 행 읽기만.
alter table public.staff_settings enable row level security;
alter table public.staff_student_scope enable row level security;
alter table public.staff_group_scope enable row level security;

create policy "staff_settings_owner_all" on public.staff_settings
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "staff_settings_self_read" on public.staff_settings
  for select to authenticated
  using (staff_id = auth.uid());

create policy "staff_student_scope_owner_all" on public.staff_student_scope
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "staff_student_scope_self_read" on public.staff_student_scope
  for select to authenticated
  using (staff_id = auth.uid());

create policy "staff_group_scope_owner_all" on public.staff_group_scope
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "staff_group_scope_self_read" on public.staff_group_scope
  for select to authenticated
  using (staff_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Tier 1 — 학생 데이터: 메뉴 권한 AND 학생 범위
-- ---------------------------------------------------------------------------

-- 3a. student_id 컬럼이 직접 있는 테이블
drop policy if exists "daily_admin_all" on public.daily_attendance;
create policy "daily_admin_all" on public.daily_attendance
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('daily')) and public.staff_can_access_student(student_id)))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('daily')) and public.staff_can_access_student(student_id)));

drop policy if exists "journals_admin_all" on public.study_journals;
create policy "journals_admin_all" on public.study_journals
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('journals')) and public.staff_can_access_student(student_id)))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('journals')) and public.staff_can_access_student(student_id)));

drop policy if exists "planner_weeks_admin_all" on public.planner_weeks;
create policy "planner_weeks_admin_all" on public.planner_weeks
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('planner')) and public.staff_can_access_student(student_id)))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('planner')) and public.staff_can_access_student(student_id)));

drop policy if exists "planner_task_checks_admin_all" on public.planner_task_checks;
create policy "planner_task_checks_admin_all" on public.planner_task_checks
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('planner')) and public.staff_can_access_student(student_id)))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('planner')) and public.staff_can_access_student(student_id)));

drop policy if exists "test_assignments_admin_all" on public.test_assignments;
create policy "test_assignments_admin_all" on public.test_assignments
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('tests')) and public.staff_can_access_student(student_id)))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('tests')) and public.staff_can_access_student(student_id)));

drop policy if exists "material_assignments_admin_all" on public.material_assignments;
create policy "material_assignments_admin_all" on public.material_assignments
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('materials')) and public.staff_can_access_student(student_id)))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('materials')) and public.staff_can_access_student(student_id)));

drop policy if exists "qna_questions_admin_all" on public.qna_questions;
create policy "qna_questions_admin_all" on public.qna_questions
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('qna')) and public.staff_can_access_student(student_id)))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('qna')) and public.staff_can_access_student(student_id)));

drop policy if exists "column_reads_admin_select" on public.column_reads;
create policy "column_reads_admin_select" on public.column_reads
  for select to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('columns')) and public.staff_can_access_student(student_id)));

-- group_members: 읽기는 교직원 누구나(단, 담당 학생 행만) — 그룹 필터·대상 선택에
-- 쓰인다. 쓰기는 'groups' 권한 + 담당 그룹 + 담당 학생. 마지막 조건이 "범위 밖 학생을
-- 내 그룹에 넣어서 담당으로 만드는" 범위 확장 공격을 막는다.
drop policy if exists "group_members_admin_all" on public.group_members;
create policy "group_members_admin_select" on public.group_members
  for select to authenticated
  using ((select public.is_owner())
      or ((select public.is_assistant()) and public.staff_can_access_student(student_id)));
create policy "group_members_admin_write" on public.group_members
  for insert to authenticated
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('groups'))
          and public.staff_can_access_group(group_id)
          and public.staff_can_access_student(student_id)));
create policy "group_members_admin_delete" on public.group_members
  for delete to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('groups'))
          and public.staff_can_access_group(group_id)
          and public.staff_can_access_student(student_id)));

-- 3b. 부모 행을 거쳐야 student_id가 나오는 테이블
drop policy if exists "journal_feedbacks_admin_all" on public.journal_feedbacks;
create policy "journal_feedbacks_admin_all" on public.journal_feedbacks
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('journals'))
          and exists (select 1 from public.study_journals j
                      where j.id = journal_feedbacks.journal_id
                        and public.staff_can_access_student(j.student_id))))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('journals'))
          and exists (select 1 from public.study_journals j
                      where j.id = journal_feedbacks.journal_id
                        and public.staff_can_access_student(j.student_id))));

drop policy if exists "planner_blocks_admin_all" on public.planner_blocks;
create policy "planner_blocks_admin_all" on public.planner_blocks
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('planner'))
          and exists (select 1 from public.planner_weeks w
                      where w.id = planner_blocks.week_id
                        and public.staff_can_access_student(w.student_id))))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('planner'))
          and exists (select 1 from public.planner_weeks w
                      where w.id = planner_blocks.week_id
                        and public.staff_can_access_student(w.student_id))));

drop policy if exists "planner_tasks_admin_all" on public.planner_tasks;
create policy "planner_tasks_admin_all" on public.planner_tasks
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('planner'))
          and exists (select 1 from public.planner_blocks b
                      join public.planner_weeks w on w.id = b.week_id
                      where b.id = planner_tasks.block_id
                        and public.staff_can_access_student(w.student_id))))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('planner'))
          and exists (select 1 from public.planner_blocks b
                      join public.planner_weeks w on w.id = b.week_id
                      where b.id = planner_tasks.block_id
                        and public.staff_can_access_student(w.student_id))));

drop policy if exists "test_attempts_admin_all" on public.test_attempts;
create policy "test_attempts_admin_all" on public.test_attempts
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('tests'))
          and exists (select 1 from public.test_assignments a
                      where a.id = test_attempts.assignment_id
                        and public.staff_can_access_student(a.student_id))))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('tests'))
          and exists (select 1 from public.test_assignments a
                      where a.id = test_attempts.assignment_id
                        and public.staff_can_access_student(a.student_id))));

drop policy if exists "student_answers_admin_all" on public.student_answers;
create policy "student_answers_admin_all" on public.student_answers
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('tests'))
          and exists (select 1 from public.test_attempts t
                      join public.test_assignments a on a.id = t.assignment_id
                      where t.id = student_answers.attempt_id
                        and public.staff_can_access_student(a.student_id))))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('tests'))
          and exists (select 1 from public.test_attempts t
                      join public.test_assignments a on a.id = t.assignment_id
                      where t.id = student_answers.attempt_id
                        and public.staff_can_access_student(a.student_id))));

drop policy if exists "qna_answers_admin_all" on public.qna_answers;
create policy "qna_answers_admin_all" on public.qna_answers
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('qna'))
          and exists (select 1 from public.qna_questions q
                      where q.id = qna_answers.question_id
                        and public.staff_can_access_student(q.student_id))))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('qna'))
          and exists (select 1 from public.qna_questions q
                      where q.id = qna_answers.question_id
                        and public.staff_can_access_student(q.student_id))));

drop policy if exists "qna_question_stars_admin_all" on public.qna_question_stars;
create policy "qna_question_stars_admin_all" on public.qna_question_stars
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('qna'))
          and exists (select 1 from public.qna_questions q
                      where q.id = qna_question_stars.question_id
                        and public.staff_can_access_student(q.student_id))))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('qna'))
          and exists (select 1 from public.qna_questions q
                      where q.id = qna_question_stars.question_id
                        and public.staff_can_access_student(q.student_id))));

-- 3c. user_id(학생 또는 학부모)를 가진 테이블
-- notifications: insert는 교직원 누구나 — 공지·칼럼 같은 광역 fan-out이 범위 밖
-- 학생에게도 가야 한다. 읽기/수정/삭제는 원장 또는 담당 학생·학부모 행만.
drop policy if exists "notifications_admin_all" on public.notifications;
create policy "notifications_admin_insert" on public.notifications
  for insert to authenticated
  with check ((select public.is_admin()));
create policy "notifications_admin_select" on public.notifications
  for select to authenticated
  using ((select public.is_owner())
      or ((select public.is_assistant()) and public.staff_can_access_profile(user_id)));
create policy "notifications_admin_update" on public.notifications
  for update to authenticated
  using ((select public.is_owner())
      or ((select public.is_assistant()) and public.staff_can_access_profile(user_id)))
  with check ((select public.is_owner())
      or ((select public.is_assistant()) and public.staff_can_access_profile(user_id)));
create policy "notifications_admin_delete" on public.notifications
  for delete to authenticated
  using ((select public.is_owner())
      or ((select public.is_assistant()) and public.staff_can_access_profile(user_id)));

drop policy if exists "material_downloads_admin_all" on public.material_downloads;
create policy "material_downloads_admin_all" on public.material_downloads
  for all to authenticated
  using ((select public.is_owner())
      or ((select public.staff_has_permission('materials')) and public.staff_can_access_profile(user_id)))
  with check ((select public.is_owner())
      or ((select public.staff_has_permission('materials')) and public.staff_can_access_profile(user_id)));

-- 동의 증적은 원장만 본다.
drop policy if exists "consent_records_select_admin" on public.consent_records;
create policy "consent_records_select_admin" on public.consent_records
  for select to authenticated
  using ((select public.is_owner()));

-- 3d. profiles — 읽기는 본인·원장·(조교: 담당 학생과 그 학부모). 쓰기는 원장만.
--     조교 본인 행의 이름·연락처 수정은 profiles_update_self(컬럼 GRANT)로 이미 된다.
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid()
      or (select public.is_owner())
      or ((select public.is_assistant()) and public.staff_can_access_profile(id)));

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- 3e. 학부모 연결 / 가입 요청 / 접속기록 — 연결 읽기만 조교(담당 학생분)에게 열고 나머지는 원장.
drop policy if exists "psl_select_self_or_admin" on public.parent_student_links;
create policy "psl_select_self_or_admin" on public.parent_student_links
  for select to authenticated
  using (parent_id = auth.uid()
      or student_id = auth.uid()
      or (select public.is_owner())
      or ((select public.is_assistant()) and public.staff_can_access_student(student_id)));

drop policy if exists "psl_admin_all" on public.parent_student_links;
create policy "psl_admin_all" on public.parent_student_links
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

drop policy if exists "psr_select_self_or_admin" on public.parent_signup_requests;
create policy "psr_select_self_or_admin" on public.parent_signup_requests
  for select to authenticated
  using (parent_id = auth.uid() or (select public.is_owner()));

drop policy if exists "psr_admin_all" on public.parent_signup_requests;
create policy "psr_admin_all" on public.parent_signup_requests
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

drop policy if exists "admin_access_logs_select_admin" on public.admin_access_logs;
create policy "admin_access_logs_select_admin" on public.admin_access_logs
  for select to authenticated
  using ((select public.is_owner()));

-- 3f. Storage — 학생 폴더({uid}/...) 버킷. 폴더명이 uuid 꼴일 때만 범위 검사.
drop policy if exists "planner_proofs_admin_all" on storage.objects;
create policy "planner_proofs_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'planner-proofs'
      and ((select public.is_owner())
        or ((select public.staff_has_permission('planner'))
            and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and public.staff_can_access_student(((storage.foldername(name))[1])::uuid))))
  with check (bucket_id = 'planner-proofs'
      and ((select public.is_owner())
        or ((select public.staff_has_permission('planner'))
            and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and public.staff_can_access_student(((storage.foldername(name))[1])::uuid))));

drop policy if exists "qna_images_admin_all" on storage.objects;
create policy "qna_images_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'qna-images'
      and ((select public.is_owner())
        or ((select public.staff_has_permission('qna'))
            and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and public.staff_can_access_student(((storage.foldername(name))[1])::uuid))))
  with check (bucket_id = 'qna-images'
      and ((select public.is_owner())
        or ((select public.staff_has_permission('qna'))
            and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and public.staff_can_access_student(((storage.foldername(name))[1])::uuid))));

-- ---------------------------------------------------------------------------
-- 4. Tier 2 — 콘텐츠(학생 식별자 없음): 메뉴 권한만
-- ---------------------------------------------------------------------------
drop policy if exists "passages_admin_all" on public.passages;
create policy "passages_admin_all" on public.passages
  for all to authenticated
  using ((select public.staff_has_permission('passages')))
  with check ((select public.staff_has_permission('passages')));

drop policy if exists "questions_admin_all" on public.questions;
create policy "questions_admin_all" on public.questions
  for all to authenticated
  using ((select public.staff_has_permission('passages')))
  with check ((select public.staff_has_permission('passages')));

drop policy if exists "test_sheets_admin_all" on public.test_sheets;
create policy "test_sheets_admin_all" on public.test_sheets
  for all to authenticated
  using ((select public.staff_has_permission('tests')))
  with check ((select public.staff_has_permission('tests')));

drop policy if exists "test_sheet_questions_admin_all" on public.test_sheet_questions;
create policy "test_sheet_questions_admin_all" on public.test_sheet_questions
  for all to authenticated
  using ((select public.staff_has_permission('tests')))
  with check ((select public.staff_has_permission('tests')));

drop policy if exists "materials_admin_all" on public.materials;
create policy "materials_admin_all" on public.materials
  for all to authenticated
  using ((select public.staff_has_permission('materials')))
  with check ((select public.staff_has_permission('materials')));

drop policy if exists "material_files_admin_all" on public.material_files;
create policy "material_files_admin_all" on public.material_files
  for all to authenticated
  using ((select public.staff_has_permission('materials')))
  with check ((select public.staff_has_permission('materials')));

drop policy if exists "material_group_targets_admin_all" on public.material_group_targets;
create policy "material_group_targets_admin_all" on public.material_group_targets
  for all to authenticated
  using ((select public.staff_has_permission('materials')))
  with check ((select public.staff_has_permission('materials')));

drop policy if exists "announcements_admin_all" on public.announcements;
create policy "announcements_admin_all" on public.announcements
  for all to authenticated
  using ((select public.staff_has_permission('announcements')))
  with check ((select public.staff_has_permission('announcements')));

drop policy if exists "columns_admin_all" on public.columns;
create policy "columns_admin_all" on public.columns
  for all to authenticated
  using ((select public.staff_has_permission('columns')))
  with check ((select public.staff_has_permission('columns')));

drop policy if exists "column_categories_admin_all" on public.column_categories;
create policy "column_categories_admin_all" on public.column_categories
  for all to authenticated
  using ((select public.staff_has_permission('columns')))
  with check ((select public.staff_has_permission('columns')));

drop policy if exists "qna_categories_admin_all" on public.qna_categories;
create policy "qna_categories_admin_all" on public.qna_categories
  for all to authenticated
  using ((select public.staff_has_permission('qna')))
  with check ((select public.staff_has_permission('qna')));

drop policy if exists "planner_tags_admin_all" on public.planner_tags;
create policy "planner_tags_admin_all" on public.planner_tags
  for all to authenticated
  using ((select public.staff_has_permission('planner')))
  with check ((select public.staff_has_permission('planner')));

drop policy if exists "planner_templates_admin_all" on public.planner_templates;
create policy "planner_templates_admin_all" on public.planner_templates
  for all to authenticated
  using ((select public.staff_has_permission('planner')))
  with check ((select public.staff_has_permission('planner')));

-- student_groups: 이름은 교직원 누구나 읽는다(필터·대상 선택). 만들기는 'groups'
-- 권한, 수정/삭제는 담당 그룹만. 조교가 만든 그룹은 원장이 범위에 넣어줘야 수정 가능.
drop policy if exists "student_groups_admin_all" on public.student_groups;
create policy "student_groups_admin_select" on public.student_groups
  for select to authenticated
  using ((select public.is_admin()));
create policy "student_groups_admin_insert" on public.student_groups
  for insert to authenticated
  with check ((select public.staff_has_permission('groups')));
create policy "student_groups_admin_update" on public.student_groups
  for update to authenticated
  using ((select public.staff_has_permission('groups')) and public.staff_can_access_group(id))
  with check ((select public.staff_has_permission('groups')) and public.staff_can_access_group(id));
create policy "student_groups_admin_delete" on public.student_groups
  for delete to authenticated
  using ((select public.staff_has_permission('groups')) and public.staff_can_access_group(id));

-- Storage — 콘텐츠 버킷
drop policy if exists "materials_storage_admin_select" on storage.objects;
drop policy if exists "materials_storage_admin_insert" on storage.objects;
drop policy if exists "materials_storage_admin_update" on storage.objects;
drop policy if exists "materials_storage_admin_delete" on storage.objects;
create policy "materials_storage_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'materials' and (select public.staff_has_permission('materials')));
create policy "materials_storage_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materials' and (select public.staff_has_permission('materials')));
create policy "materials_storage_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'materials' and (select public.staff_has_permission('materials')))
  with check (bucket_id = 'materials' and (select public.staff_has_permission('materials')));
create policy "materials_storage_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'materials' and (select public.staff_has_permission('materials')));

drop policy if exists "question_assets_admin_write" on storage.objects;
drop policy if exists "question_assets_admin_update" on storage.objects;
drop policy if exists "question_assets_admin_delete" on storage.objects;
create policy "question_assets_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-assets'
      and ((select public.staff_has_permission('passages')) or (select public.staff_has_permission('tests'))));
create policy "question_assets_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'question-assets'
      and ((select public.staff_has_permission('passages')) or (select public.staff_has_permission('tests'))))
  with check (bucket_id = 'question-assets'
      and ((select public.staff_has_permission('passages')) or (select public.staff_has_permission('tests'))));
create policy "question_assets_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-assets'
      and ((select public.staff_has_permission('passages')) or (select public.staff_has_permission('tests'))));

-- 그대로 두는 것: is_admin()을 "교직원 누구나 읽기"로 쓰는 qna_categories_read /
-- column_categories_read, notifications_to_admin(학생→관리자 알림), submit_attempt()의
-- is_admin() 우회(교직원은 응시하지 않음), 학생·학부모 정책 전부.
