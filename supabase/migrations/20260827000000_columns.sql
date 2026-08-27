-- ============================================================================
-- 칼럼 — 원장이 쓰는 글 + 학생 읽기 완료 추적
--
-- 원장이 국어 개념·독해 노하우를 글로 올리면 학생이 읽고 [읽기 완료]를 누른다.
-- 관리자는 누가 읽었는지 추적한다. materials(자료 배부)와 닮았지만 다르다:
--   - materials = 파일(PDF) 배부, 다운로드·열람 로깅
--   - columns   = 본문(HTML) 자체가 콘텐츠, "읽었다" 한 번의 확인
-- 우선 전체 공개(발행하면 승인 학생·학부모 모두 열람)로 단순하게 간다.
-- 그룹 대상 지정은 materials처럼 나중에 붙일 여지를 남긴다.
-- ============================================================================

create table public.columns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,                                 -- HTML (TipTap), sanitizeRichHtml로 저장
  is_published boolean not null default false,
  published_at timestamptz,                           -- 예약 발행: null=초안, 미래값 가능
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index columns_published_idx
  on public.columns (is_published, published_at desc);

create trigger tr_columns_touch
  before update on public.columns
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- column_reads — 학생 읽기 완료 (한 번 누르면 끝, 취소 없음)
-- ---------------------------------------------------------------------------
create table public.column_reads (
  column_id uuid not null references public.columns(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (column_id, student_id)
);

create index column_reads_student_idx on public.column_reads (student_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.columns enable row level security;
alter table public.column_reads enable row level security;

-- columns: 관리자 전권
create policy "columns_admin_all"
  on public.columns for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- columns: 발행+시점 도달한 것은 로그인 사용자 누구나 읽는다(학생·학부모 공통)
create policy "columns_published_read"
  on public.columns for select
  to authenticated
  using (
    is_published = true
    and (published_at is null or published_at <= now())
  );

-- column_reads: 학생 본인이 자기 읽음만 기록/조회. 승인 상태에서만.
-- 발행 안 된 칼럼을 읽음 처리하는 우회를 막으려 대상 칼럼의 가시성도 확인한다.
create policy "column_reads_student_insert"
  on public.column_reads for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'student' and p.status = 'approved'
    )
    and exists (
      select 1 from public.columns c
       where c.id = column_reads.column_id
         and c.is_published = true
         and (c.published_at is null or c.published_at <= now())
    )
  );

create policy "column_reads_student_select"
  on public.column_reads for select
  to authenticated
  using (student_id = auth.uid());

-- 관리자는 읽음 현황 전체 조회
create policy "column_reads_admin_select"
  on public.column_reads for select
  to authenticated
  using (public.is_admin());
