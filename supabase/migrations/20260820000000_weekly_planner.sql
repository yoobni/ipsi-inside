-- ============================================================================
-- 주간 국어 맞춤 플래너 및 학습 감독 시스템
--   원장: 학생별 주간 타임테이블 배정(고정 블록 + 국어 블록×세부 과제)
--   학생: 과제별 O(done)/△(late)/X(missed) 체크 — 당일 24:00까지만
--
-- 시간 표현은 date가 아니라 (day_of_week 0~6, start_min/end_min 분)으로 둔다.
-- 날짜로 박으면 템플릿이 특정 주에 묶여 재사용이 안 됨. 실제 날짜는
-- week_start + day_of_week 로 계산 (planner_task_date 참고).
--
-- Step 5~7(사진 첨부 / 통계 / 자동 알림)용 컬럼·버킷도 여기서 미리 만든다.
-- 재마이그레이션을 피하기 위함 — photo_path / late_reason / weekly_comment.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- planner_weeks — 학생 × 주(週). 모든 플래너 데이터의 루트.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.planner_weeks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,                       -- KST 기준 그 주의 월요일
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  published_at timestamptz,
  -- 주간 한 줄 피드백 (Step 6에서 UI 연결)
  weekly_comment text,
  comment_written_by uuid references public.profiles(id),
  comment_written_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, week_start),
  -- 주 시작은 항상 월요일 (ISO dow: 월=1)
  constraint planner_weeks_starts_monday
    check (extract(isodow from week_start) = 1)
);

create index planner_weeks_student_idx
  on public.planner_weeks (student_id, week_start desc);
create index planner_weeks_week_idx
  on public.planner_weeks (week_start desc, status);

create trigger tr_planner_weeks_touch
  before update on public.planner_weeks
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- planner_blocks — 타임테이블 위의 시간 블록.
--   kind='fixed'  : 학교/타 학원 등 고정 일정. 라벨+색상만 (세부 과제 없음)
--   kind='korean' : 국어 공부 시간(주황 하이라이트). 세부 과제를 가짐
-- ─────────────────────────────────────────────────────────────────────────────
create table public.planner_blocks (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.planner_weeks(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),  -- 0=월 … 6=일
  start_min int not null check (start_min >= 0 and start_min < 1440), -- 자정 기준 분
  end_min int not null check (end_min > 0 and end_min <= 1440),
  kind text not null check (kind in ('korean', 'fixed')),
  label text,                                     -- fixed의 일정명 (예: 학교, ○○수학학원)
  color text,                                     -- fixed 블록 색상
  memo text,
  position int not null default 1,
  created_at timestamptz not null default now(),
  constraint planner_blocks_time_order check (end_min > start_min),
  -- 고정 블록은 라벨이 없으면 화면에서 빈 색상 덩어리가 됨
  constraint planner_blocks_fixed_needs_label
    check (kind <> 'fixed' or (label is not null and length(btrim(label)) > 0))
);

create index planner_blocks_week_idx
  on public.planner_blocks (week_id, day_of_week, start_min);

-- ─────────────────────────────────────────────────────────────────────────────
-- planner_tags — 국어 영역 태그 마스터. 원장이 추가/보관 관리.
--   태그별 이행률 통계(Step 6)의 group by 축이라 text가 아닌 마스터 테이블로 둠.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.planner_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  position int not null default 1,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index planner_tags_active_idx
  on public.planner_tags (archived, position, name);

insert into public.planner_tags (name, color, position) values
  ('비문학 독해', 'sky',     1),
  ('문학 분석',   'violet',  2),
  ('화법과 작문', 'emerald', 3),
  ('언어와 매체', 'amber',   4),
  ('EBS 연계',    'rose',    5),
  ('기출 오답',   'slate',   6)
on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- planner_tasks — 국어 블록에 붙는 세부 과제. 학생 체크의 단위.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.planner_tasks (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.planner_blocks(id) on delete cascade,
  tag_id uuid references public.planner_tags(id) on delete set null,
  title text not null check (length(btrim(title)) > 0),
  position int not null default 1,
  created_at timestamptz not null default now()
);

create index planner_tasks_block_idx
  on public.planner_tasks (block_id, position);
create index planner_tasks_tag_idx
  on public.planner_tasks (tag_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- planner_task_checks — 학생 수행 상태. 과제 1개당 최대 1행.
--   student_id / task_date 는 정규화상 task→block→week 로 유도 가능하지만,
--   RLS 조건과 주간 통계 집계에서 매번 3단 조인을 피하려고 denormalize.
--   두 값의 정합성은 insert 정책에서 planner_task_* 함수로 강제한다.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.planner_task_checks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.planner_tasks(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  task_date date not null,
  status text not null check (status in ('done', 'late', 'missed')),  -- O / △ / X
  late_reason text,                               -- △ 사유 (선택)
  photo_path text,                                -- planner-proofs 버킷 키 (Step 5)
  checked_at timestamptz not null default now(),  -- ★ 벼락치기 판별용 실제 체크 시각
  updated_at timestamptz not null default now()
);

create index planner_task_checks_student_date_idx
  on public.planner_task_checks (student_id, task_date desc);
create index planner_task_checks_status_idx
  on public.planner_task_checks (status);

create trigger tr_planner_task_checks_touch
  before update on public.planner_task_checks
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- planner_templates — '표준 주간 국어 루틴' 저장/불러오기.
--   payload는 블록/과제 구조의 JSONB 스냅샷. 참조 무결성이 필요 없고
--   불러올 때 복사만 하면 되므로 테이블로 정규화하지 않는다.
--   (시험 배정이 그룹 멤버를 스냅샷으로 뜨는 것과 같은 판단)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.planner_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  payload jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planner_templates_name_idx
  on public.planner_templates (name);

create trigger tr_planner_templates_touch
  before update on public.planner_templates
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 헬퍼 — 과제 → 실제 날짜 / 소유 학생.
--   클라이언트가 보낸 student_id·task_date를 그대로 믿으면 지난 과제를
--   오늘 날짜로 찍어 24:00 제한을 우회할 수 있다. 서버가 원본에서 다시 계산해
--   insert 정책에서 대조한다. SECURITY DEFINER로 내부 조인의 RLS는 우회.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.planner_task_date(p_task_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select w.week_start + b.day_of_week
  from public.planner_tasks t
  join public.planner_blocks b on b.id = t.block_id
  join public.planner_weeks w on w.id = b.week_id
  where t.id = p_task_id;
$$;

-- 발행(published)된 주차의 과제일 때만 학생 id를 돌려준다.
-- 초안 상태 플래너에는 학생이 체크를 남길 수 없어야 함.
create or replace function public.planner_task_student(p_task_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select w.student_id
  from public.planner_tasks t
  join public.planner_blocks b on b.id = t.block_id
  join public.planner_weeks w on w.id = b.week_id
  where t.id = p_task_id
    and w.status = 'published';
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.planner_weeks       enable row level security;
alter table public.planner_blocks      enable row level security;
alter table public.planner_tags        enable row level security;
alter table public.planner_tasks       enable row level security;
alter table public.planner_task_checks enable row level security;
alter table public.planner_templates   enable row level security;

-- admin 전체 ---------------------------------------------------------------
create policy "planner_weeks_admin_all"
  on public.planner_weeks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "planner_blocks_admin_all"
  on public.planner_blocks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "planner_tags_admin_all"
  on public.planner_tags for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "planner_tasks_admin_all"
  on public.planner_tasks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "planner_task_checks_admin_all"
  on public.planner_task_checks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "planner_templates_admin_all"
  on public.planner_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 학생/학부모 read ----------------------------------------------------------
-- 발행된 주차만. 학부모는 parent_student_links 조인으로 자녀 것.
create policy "planner_weeks_self_read"
  on public.planner_weeks for select to authenticated
  using (
    status = 'published'
    and (
      student_id = auth.uid()
      or exists (
        select 1 from public.parent_student_links psl
        where psl.parent_id = auth.uid()
          and psl.student_id = planner_weeks.student_id
      )
    )
  );

-- 블록/과제는 부모 행이 보이면 보인다.
-- (서브쿼리의 planner_weeks 접근에 위 정책이 그대로 적용되므로
--  "보이는 주차의 블록만"이 자동으로 성립 — material_files와 같은 패턴)
create policy "planner_blocks_read"
  on public.planner_blocks for select to authenticated
  using (
    exists (
      select 1 from public.planner_weeks w
      where w.id = planner_blocks.week_id
    )
  );

create policy "planner_tasks_read"
  on public.planner_tasks for select to authenticated
  using (
    exists (
      select 1 from public.planner_blocks b
      where b.id = planner_tasks.block_id
    )
  );

-- 태그는 과제에 붙어 노출되므로 보관되지 않은 것은 전원 read.
create policy "planner_tags_read"
  on public.planner_tags for select to authenticated
  using (archived = false);

-- 체크 read: 본인 또는 자녀
create policy "planner_task_checks_self_read"
  on public.planner_task_checks for select to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = auth.uid()
        and psl.student_id = planner_task_checks.student_id
    )
  );

-- 학생 체크 write — 당일 24:00 제한 (2중 방어의 DB측) ------------------------
-- task_date / student_id 를 원본에서 재계산해 대조하고,
-- 그 날짜가 KST 기준 '오늘'일 때만 통과시킨다.
create policy "planner_task_checks_student_insert"
  on public.planner_task_checks for insert to authenticated
  with check (
    student_id = auth.uid()
    and public.planner_task_student(task_id) = auth.uid()
    and task_date = public.planner_task_date(task_id)
    and task_date = (now() at time zone 'Asia/Seoul')::date
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.status = 'approved'
    )
  );

-- 같은 날 안에서는 수정 가능. 날짜가 넘어가면 잠긴다.
create policy "planner_task_checks_student_update"
  on public.planner_task_checks for update to authenticated
  using (
    student_id = auth.uid()
    and task_date = (now() at time zone 'Asia/Seoul')::date
  )
  with check (
    student_id = auth.uid()
    and task_date = public.planner_task_date(task_id)
    and task_date = (now() at time zone 'Asia/Seoul')::date
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage 버킷 — 'planner-proofs' (private, 이미지 5MiB, Step 5에서 사용)
--   materials 버킷과 달리 학생이 직접 insert 해야 한다.
--   경로는 '{student_id}/{uuid}.jpg' — 첫 폴더가 본인 uid일 때만 쓰기 허용.
--   키는 반드시 ASCII (한글 키는 Storage가 `Invalid key`로 거부 — 커밋 ff47490)
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'planner-proofs',
  'planner-proofs',
  false,
  5242880,                               -- 5 * 1024 * 1024
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "planner_proofs_admin_all"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'planner-proofs' and public.is_admin())
  with check (bucket_id = 'planner-proofs' and public.is_admin());

create policy "planner_proofs_student_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'planner-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "planner_proofs_student_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'planner-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "planner_proofs_student_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'planner-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
