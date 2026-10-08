-- ============================================================================
-- 개념·작품·기출·문제 DB 연결 — 학생용 라이브러리(허브)
--
-- 지문/문항 DB를 시험 제작에만 쓰지 않고 학습 콘텐츠로 연결한다. 작품 페이지에서
-- 관련 지문 → 이 작품이 나온 기출 → 문항 수·보충 풀기 → OX 훈련 → 내 성취도까지.
-- 개념·기출 페이지도 같은 꼴. 새 데이터가 아니라 태그(20261008060000) 위의 허브다.
--
-- 학생은 passages 를 배정된 시험을 통해서만 읽을 수 있다(RLS). 허브는 지문 **제목·
-- 출처·문항 수** 같은 메타만 보여 주면 되므로 SECURITY DEFINER RPC 두 개로 메타만
-- 돌려준다. 본문·정답은 절대 안 나간다(본문은 시험/가이드 안에서만).
-- ============================================================================

-- 목록: 작품 / 개념 / 기출 출처 + 각각의 지문·문항·훈련 수
create or replace function public.library_index()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'works', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'title', w.title, 'author', w.author, 'genre', w.genre, 'era', w.era,
        'passages', (select count(*) from public.passages p where p.work_id = w.id),
        'questions', (select count(*) from public.questions q join public.passages p on p.id = q.passage_id where p.work_id = w.id),
        'drills', (select count(*) from public.drills d where d.work_id = w.id and d.is_published)
      ) order by w.genre nulls last, w.title)
      from public.works w where w.archived = false
    ), '[]'::jsonb),
    'concepts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'area', c.area, 'parent_id', c.parent_id,
        'has_body', (c.body_html is not null and length(c.body_html) > 0),
        'questions', (select count(*) from public.question_concepts qc where qc.concept_id = c.id),
        'drills', (select count(*) from public.drill_concepts dc join public.drills d on d.id = dc.drill_id where dc.concept_id = c.id and d.is_published)
      ) order by c.position, c.title)
      from public.concepts c where c.archived = false
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'label', s.label, 'year', s.year, 'month', s.month, 'exam_kind', s.exam_kind, 'grade', s.grade,
        'passages', (select count(*) from public.passages p where p.source_id = s.id),
        'questions', (select count(*) from public.questions q join public.passages p on p.id = q.passage_id where p.source_id = s.id)
      ) order by s.year desc nulls last, s.month desc nulls last, s.label)
      from public.exam_sources s where s.archived = false
    ), '[]'::jsonb)
  )
$$;
revoke all on function public.library_index() from public, anon;
grant execute on function public.library_index() to authenticated;

-- 상세: kind = 'work' | 'concept' | 'source'. 지문 메타(제목·영역·출처·문항 수), 관련
-- 기출, 유형별 문항 수, 발행된 훈련, 연결 개념/작품. 본문·정답 없음.
create or replace function public.library_detail(p_kind text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
ps as (
  select p.id, p.title, p.source_type::text as source_type, p.work_id, p.source_id,
         (select count(*) from public.questions q where q.passage_id = p.id) as questions
  from public.passages p
  where (p_kind = 'work' and p.work_id = p_id)
     or (p_kind = 'source' and p.source_id = p_id)
     or (p_kind = 'concept' and exists (
          select 1 from public.questions q join public.question_concepts qc on qc.question_id = q.id
          where q.passage_id = p.id and qc.concept_id = p_id))
),
qs as (
  select q.id, q.type_id, q.passage_id
  from public.questions q
  where q.passage_id in (select id from ps)
    and (p_kind <> 'concept' or exists (select 1 from public.question_concepts qc where qc.question_id = q.id and qc.concept_id = p_id))
),
head as (
  select case p_kind
    when 'work' then (select jsonb_build_object('title', w.title, 'author', w.author, 'genre', w.genre, 'era', w.era) from public.works w where w.id = p_id and not w.archived)
    when 'concept' then (select jsonb_build_object('title', c.title, 'area', c.area, 'body_html', c.body_html,
                           'parent', (select jsonb_build_object('id', pc.id, 'title', pc.title) from public.concepts pc where pc.id = c.parent_id)) from public.concepts c where c.id = p_id and not c.archived)
    when 'source' then (select jsonb_build_object('title', s.label, 'year', s.year, 'month', s.month, 'exam_kind', s.exam_kind, 'grade', s.grade) from public.exam_sources s where s.id = p_id and not s.archived)
  end as h
)
select case when (select h from head) is null then null else jsonb_build_object(
  'kind', p_kind,
  'id', p_id,
  'head', (select h from head),
  'passages', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', ps.id, 'title', ps.title, 'source_type', ps.source_type, 'questions', ps.questions,
      'source', (select s.label from public.exam_sources s where s.id = ps.source_id),
      'work', (select w.title from public.works w where w.id = ps.work_id)
    ) order by ps.title) from ps
  ), '[]'::jsonb),
  'question_count', (select count(*) from qs),
  'by_type', coalesce((
    select jsonb_agg(jsonb_build_object('type_id', t.type_id, 'label', coalesce(qt.label, '미분류'), 'count', t.n) order by t.n desc)
    from (select type_id, count(*) n from qs group by type_id) t
    left join public.question_types qt on qt.id = t.type_id
  ), '[]'::jsonb),
  -- 이 작품/개념이 나온 기출(지문의 출처), 기출 페이지면 그 출처의 작품들
  'sources', coalesce((
    select jsonb_agg(distinct jsonb_build_object('id', s.id, 'label', s.label))
    from ps join public.exam_sources s on s.id = ps.source_id where p_kind <> 'source'
  ), '[]'::jsonb),
  'works', coalesce((
    select jsonb_agg(distinct jsonb_build_object('id', w.id, 'title', w.title, 'author', w.author))
    from ps join public.works w on w.id = ps.work_id where p_kind <> 'work'
  ), '[]'::jsonb),
  'concepts', coalesce((
    select jsonb_agg(distinct jsonb_build_object('id', c.id, 'title', c.title))
    from qs join public.question_concepts qc on qc.question_id = qs.id join public.concepts c on c.id = qc.concept_id
    where p_kind <> 'concept' and not c.archived
  ), '[]'::jsonb),
  'drills', coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'kind', d.kind) order by d.published_at desc)
    from public.drills d
    where d.is_published and (d.published_at is null or d.published_at <= now())
      and ((p_kind = 'work' and d.work_id = p_id)
        or (p_kind = 'concept' and exists (select 1 from public.drill_concepts dc where dc.drill_id = d.id and dc.concept_id = p_id)))
  ), '[]'::jsonb)
) end
$$;
revoke all on function public.library_detail(text, uuid) from public, anon;
grant execute on function public.library_detail(text, uuid) to authenticated;

comment on function public.library_index() is '학생 라이브러리 목록(작품·개념·기출 + 개수). 메타만.';
comment on function public.library_detail(text, uuid) is '라이브러리 상세(지문 제목·기출·유형별 수·훈련·연결). 본문·정답 없음.';
