-- ============================================================================
-- 자료 다운로드/열람 로깅 — 누가 언제 받았는지/봤는지 admin 추적
--   source = 'download' (파일 다운로드) | 'view' (인앱 PDF 뷰어)
-- ============================================================================

create table public.material_downloads (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'download'
    check (source in ('download', 'view')),
  downloaded_at timestamptz not null default now()
);

create index material_downloads_material_idx
  on public.material_downloads (material_id, downloaded_at desc);
create index material_downloads_user_idx
  on public.material_downloads (user_id, downloaded_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.material_downloads enable row level security;

-- admin: 모든 행 select/all
create policy "material_downloads_admin_all"
  on public.material_downloads for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 본인이 자기 다운로드 행을 insert (다운로드/뷰 시점에 server route handler에서)
create policy "material_downloads_self_insert"
  on public.material_downloads for insert
  to authenticated
  with check (user_id = auth.uid());

-- 본인 행 select (선택사항 — 향후 "내 다운로드 이력" 표시 시 사용)
create policy "material_downloads_self_read"
  on public.material_downloads for select
  to authenticated
  using (user_id = auth.uid());
