-- ============================================================================
-- 작품/지문별 학습 가이드 — 사이트 안에서 작품 하나를 처음부터 끝까지 공부하는 자습서
--
-- 흐름(단계 8종, 순서 자유): intro(핵심 가이드) → read(지문 읽기) → visual(인물 관계·
-- 개념도 이미지) → comic(핵심 장면 이미지) → ox(훈련) → questions(관련 문항 → 보충 세트)
-- → review(틀린 것 복습 안내) → summary(핵심 정리).
--
-- 지문·문항은 시험에 배정된 학생만 읽을 수 있다(RLS). 가이드가 지문 본문을 보여 주려면
-- 새 경로가 필요하다 → guide_content() SECURITY DEFINER 가 **발행된 가이드의 read 단계에
-- 연결된 지문 본문**만 돌려준다. 문항 풀이는 questions 단계가 보충 세트(create_practice_set,
-- work 태그)를 만들어 기존 시험 흐름으로 보낸다 — 정답은 여전히 RPC 뒤에.
--
-- 진도는 guide_progress(column_reads 패턴: 단계 완료 = 1행). 이미지는 guide-assets 버킷
-- (원장 업로드, 공개 읽기 — 학습 자료라 개인정보 아님).
-- ============================================================================

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  work_id uuid references public.works(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guides_status_idx on public.guides (status, published_at desc);
create index guides_work_idx on public.guides (work_id);
create trigger tr_guides_touch before update on public.guides
  for each row execute function public.touch_updated_at();

-- payload 는 kind 별:
--   intro/summary/review {html}    read {passage_id, note?}    visual/comic {images:[{path, caption}], html?}
--   ox {drill_id}                  questions {size?, note?}  (작품 태그로 보충 세트 생성)
create table public.guide_steps (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guides(id) on delete cascade,
  position int not null,
  kind text not null check (kind in ('intro', 'read', 'visual', 'comic', 'ox', 'questions', 'review', 'summary')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index guide_steps_guide_idx on public.guide_steps (guide_id, position);

create table public.guide_progress (
  guide_id uuid not null references public.guides(id) on delete cascade,
  step_id uuid not null references public.guide_steps(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (step_id, student_id)
);
create index guide_progress_student_idx on public.guide_progress (student_id, guide_id);

alter table public.guides enable row level security;
alter table public.guide_steps enable row level security;
alter table public.guide_progress enable row level security;

-- 콘텐츠 작성은 'passages' 권한(지문/문항·훈련과 같은 축)
create policy "guides_staff_write" on public.guides for all to authenticated
  using ((select public.staff_has_permission('passages'))) with check ((select public.staff_has_permission('passages')));
create policy "guides_published_read" on public.guides for select to authenticated
  using (status = 'published' and (published_at is null or published_at <= now()));

create policy "guide_steps_staff_write" on public.guide_steps for all to authenticated
  using ((select public.staff_has_permission('passages'))) with check ((select public.staff_has_permission('passages')));
create policy "guide_steps_published_read" on public.guide_steps for select to authenticated
  using (exists (select 1 from public.guides g where g.id = guide_steps.guide_id and g.status = 'published' and (g.published_at is null or g.published_at <= now())));

-- 진도: 학생 본인 insert/select(발행된 가이드만), 학부모 select, 교직원 담당 학생 select
create policy "guide_progress_student_insert" on public.guide_progress for insert to authenticated
  with check (student_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'approved')
    and exists (select 1 from public.guides g where g.id = guide_progress.guide_id and g.status = 'published'));
create policy "guide_progress_self_read" on public.guide_progress for select to authenticated
  using (student_id = auth.uid()
      or exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = guide_progress.student_id));
create policy "guide_progress_staff_read" on public.guide_progress for select to authenticated
  using ((select public.is_owner()) or public.staff_can_access_student(student_id));

-- 이미지 버킷 — 학습 자료(개인정보 아님). 공개 읽기, 쓰기는 'passages' 권한.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guide-assets', 'guide-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
create policy "guide_assets_public_read" on storage.objects for select
  using (bucket_id = 'guide-assets');
create policy "guide_assets_staff_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'guide-assets' and (select public.staff_has_permission('passages')));
create policy "guide_assets_staff_update" on storage.objects for update to authenticated
  using (bucket_id = 'guide-assets' and (select public.staff_has_permission('passages')))
  with check (bucket_id = 'guide-assets' and (select public.staff_has_permission('passages')));
create policy "guide_assets_staff_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'guide-assets' and (select public.staff_has_permission('passages')));

-- 발행된 가이드의 read 단계에 연결된 지문 본문. 그 외엔 null. 정답·문항은 안 나간다.
create or replace function public.guide_passage(p_guide_id uuid, p_passage_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (
      select 1 from public.guides g
      join public.guide_steps s on s.guide_id = g.id and s.kind = 'read' and (s.payload->>'passage_id')::uuid = p_passage_id
      where g.id = p_guide_id
        and ((g.status = 'published' and (g.published_at is null or g.published_at <= now())) or public.is_admin())
    ) then null
    else (
      select jsonb_build_object('id', p.id, 'title', p.title, 'content', p.content, 'source_type', p.source_type,
                                'work', (select w.title from public.works w where w.id = p.work_id),
                                'source', (select s.label from public.exam_sources s where s.id = p.source_id))
      from public.passages p where p.id = p_passage_id
    )
  end
$$;
revoke all on function public.guide_passage(uuid, uuid) from public, anon;
grant execute on function public.guide_passage(uuid, uuid) to authenticated;

comment on table public.guides is '작품/지문 학습 가이드(단계형 자습서). 발행된 것만 학생에게.';
comment on function public.guide_passage(uuid, uuid) is '발행된 가이드의 read 단계 지문 본문만. 문항·정답 없음.';
