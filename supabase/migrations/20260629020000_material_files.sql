-- ============================================================================
-- 자료 묶음 배부 — material = 세트(제목/대상/만료), material_files = 그 안의 N개 PDF.
--   원장은 여러 PDF를 한 번에 올리고, 학생은 세트 하나에서 파일들을 봄.
--   (기존 materials는 0건이라 데이터 마이그레이션 불필요. 단건 파일 컬럼은 nullable로 완화.)
-- ============================================================================

create table public.material_files (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  position int not null default 1,
  created_at timestamptz not null default now()
);

create index material_files_material_idx
  on public.material_files (material_id, position);

-- 단건 파일 컬럼은 더 이상 필수 아님 (파일은 material_files로 이동)
alter table public.materials alter column storage_path drop not null;
alter table public.materials alter column file_name drop not null;
alter table public.materials alter column file_size_bytes drop not null;

alter table public.material_files enable row level security;

create policy "material_files_admin_all"
  on public.material_files for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 부모 material이 보이는 사용자만 그 파일을 읽음.
-- (서브쿼리의 materials 접근에 materials RLS가 적용되므로 자동으로 "보이는 자료의 파일만")
create policy "material_files_read"
  on public.material_files for select
  to authenticated
  using (
    exists (
      select 1 from public.materials m
      where m.id = material_files.material_id
    )
  );
