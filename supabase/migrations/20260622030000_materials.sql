-- ============================================================================
-- 자료 배부 (PDF) — 어드민이 업로드한 PDF를 학생/학부모에게 광역/핀포인트로 배포
--   audience='all'/'student'/'parent' : 광역. material_assignments 행 불필요.
--   audience='targeted'                : 핀포인트. material_assignments 학생 + 그 학부모.
-- ============================================================================

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  audience text not null default 'all'
    check (audience in ('all', 'student', 'parent', 'targeted')),
  storage_path text not null,          -- bucket 'materials' 안에서의 path
  file_name text not null,             -- 원본 파일명 (다운로드 노출용)
  file_size_bytes bigint not null check (file_size_bytes > 0),
  is_published boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index materials_published_idx
  on public.materials (is_published, published_at desc);
create index materials_audience_idx
  on public.materials (audience) where is_published;

create trigger tr_materials_touch
  before update on public.materials
  for each row execute function public.touch_updated_at();

create table public.material_assignments (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  assigned_by_school text,
  assigned_at timestamptz not null default now(),
  unique (material_id, student_id)
);

create index material_assignments_material_idx
  on public.material_assignments (material_id);
create index material_assignments_student_idx
  on public.material_assignments (student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.materials enable row level security;
alter table public.material_assignments enable row level security;

-- admin 전체
create policy "materials_admin_all"
  on public.materials for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "material_assignments_admin_all"
  on public.material_assignments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 학생/학부모 read: published + 기간 유효 + audience 매칭
--   - 'student' audience도 학부모(자녀가 학생인 부모)에게 노출 — 자녀가 받는 자료는 학부모도 봄
create policy "materials_audience_read"
  on public.materials for select
  to authenticated
  using (
    is_published = true
    and (published_at is null or published_at <= now())
    and (expires_at is null or expires_at > now())
    and (
      audience = 'all'
      or (
        audience = 'student'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and (
              p.role = 'student'
              or (
                p.role = 'parent'
                and exists (
                  select 1 from public.parent_student_links psl
                  join public.profiles cp on cp.id = psl.student_id
                  where psl.parent_id = auth.uid()
                    and cp.role = 'student'
                )
              )
            )
        )
      )
      or (
        audience = 'parent'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'parent'
        )
      )
      or (
        audience = 'targeted'
        and (
          exists (
            select 1 from public.material_assignments ma
            where ma.material_id = materials.id and ma.student_id = auth.uid()
          )
          or exists (
            select 1 from public.material_assignments ma
            join public.parent_student_links psl on psl.student_id = ma.student_id
            where ma.material_id = materials.id and psl.parent_id = auth.uid()
          )
        )
      )
    )
  );

-- 본인/자녀 배정 read
create policy "material_assignments_self_read"
  on public.material_assignments for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = auth.uid()
        and psl.student_id = material_assignments.student_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage 버킷 — 'materials' (private, PDF 전용, 30MiB cap)
-- 학생/학부모 직접 read 정책은 두지 않음. 다운로드는 server route handler에서
-- RLS 검증 후 short-TTL signed URL로 우회.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,
  31457280,                              -- 30 * 1024 * 1024
  array['application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "materials_storage_admin_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'materials' and public.is_admin());

create policy "materials_storage_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'materials' and public.is_admin());

create policy "materials_storage_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'materials' and public.is_admin())
  with check (bucket_id = 'materials' and public.is_admin());

create policy "materials_storage_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'materials' and public.is_admin());
