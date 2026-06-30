-- ============================================================================
-- 자료 배부 × 그룹 연결
--   audience='group' + material_group_targets(material_id, group_id) 직접 관계.
--   동적: 그룹 멤버십이 바뀌면 노출 대상도 즉시 바뀜(배정 스냅샷 아님).
-- ============================================================================

-- 1) audience 'group' 허용
alter table public.materials drop constraint if exists materials_audience_check;
alter table public.materials
  add constraint materials_audience_check
  check (audience in ('all', 'student', 'parent', 'targeted', 'group'));

-- 2) 자료 ↔ 그룹 타깃
create table public.material_group_targets (
  material_id uuid not null references public.materials(id) on delete cascade,
  group_id uuid not null references public.student_groups(id) on delete cascade,
  added_by uuid not null references public.profiles(id),
  added_at timestamptz not null default now(),
  primary key (material_id, group_id)
);

create index material_group_targets_group_idx
  on public.material_group_targets (group_id);

alter table public.material_group_targets enable row level security;

create policy "material_group_targets_admin_all"
  on public.material_group_targets for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3) 현재 사용자가 이 자료의 타깃 그룹에 속하는지 (학생 본인 또는 자녀의 학부모).
--    SECURITY DEFINER로 내부 테이블 RLS를 우회 → materials 정책을 단순/견고하게.
create or replace function public.user_in_material_group(p_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.material_group_targets mgt
    join public.group_members gm on gm.group_id = mgt.group_id
    where mgt.material_id = p_material_id
      and (
        gm.student_id = auth.uid()
        or exists (
          select 1 from public.parent_student_links psl
          where psl.parent_id = auth.uid()
            and psl.student_id = gm.student_id
        )
      )
  );
$$;

-- 4) materials 읽기 정책에 'group' 분기 추가 (기존 정책 재작성)
drop policy if exists "materials_audience_read" on public.materials;

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
      or (
        audience = 'group'
        and public.user_in_material_group(materials.id)
      )
    )
  );
