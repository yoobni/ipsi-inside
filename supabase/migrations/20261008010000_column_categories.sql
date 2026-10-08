-- ============================================================================
-- 칼럼 카테고리 — 문학 / 독서 / 언어와 매체 / 공부법 / 입시·공지
--
-- 원장이 화면에서 추가·수정·보관한다(qna_categories와 같은 꼴). 칼럼의
-- category_id는 nullable — 기존 칼럼은 "미분류"로 남고, 카테고리를 보관해도
-- 칼럼은 그대로다(on delete set null). 읽기완료(column_reads)는 건드리지 않는다.
-- ============================================================================

create table public.column_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index column_categories_order_idx
  on public.column_categories (archived, position, created_at);

create trigger tr_column_categories_touch
  before update on public.column_categories
  for each row execute function public.touch_updated_at();

alter table public.columns
  add column category_id uuid references public.column_categories(id) on delete set null;

create index columns_category_idx
  on public.columns (category_id, is_published, published_at desc);

-- RLS: 관리자 전권, 학생·학부모는 보관 안 된 것만 읽기(목록 칩·배지용).
-- columns 쓰기는 기존 columns_admin_all 이 category_id 까지 덮는다.
alter table public.column_categories enable row level security;

create policy "column_categories_admin_all"
  on public.column_categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "column_categories_read"
  on public.column_categories for select
  to authenticated
  using (archived = false or public.is_admin());

-- 시드 — 원장이 화면에서 수정/추가/보관한다.
insert into public.column_categories (label, position) values
  ('문학', 0),
  ('독서', 1),
  ('언어와 매체', 2),
  ('공부법', 3),
  ('입시·공지', 4);
