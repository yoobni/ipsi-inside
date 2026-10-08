-- ============================================================================
-- 문항 태그 체계 — 유형 · 작품/제재 · 기출 출처 · 개념 + 문항 해설
--
-- 시험 분석(유형별·난이도별 정답률), 누적 취약점→보충 추천, 작품/개념 허브,
-- 학습 가이드가 전부 "태깅된 문항" 위에서 돈다. 지금은 unit_major/unit_minor
-- 자유 텍스트뿐이라 "고전소설 64%" 같은 숫자를 만들 수 없었다.
--
-- 사전(dictionary) 4개는 원장이 어드민에서 관리하고, 지문/문항 등록 폼과 CSV가
-- 참조한다. 전부 nullable FK — 태깅 안 된 문항은 집계에서 '미분류'로 따로 센다.
--
-- 해설은 questions 컬럼이 아니라 별도 테이블(question_explanations)이다.
-- questions 는 배정된 학생이 전 컬럼을 읽을 수 있어서(correct_answer 포함 —
-- 이미 알려진 틈), 해설을 컬럼으로 넣으면 응시 전에 API로 읽힌다. 별도 테이블은
-- "그 문항이 든 시험을 **제출한** 학생"에게만 연다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 사전 테이블
-- ---------------------------------------------------------------------------
-- 문항 유형: 영역(passage_source) 아래 1단계. 예) 문학 > 표현상 특징
create table public.question_types (
  id uuid primary key default gen_random_uuid(),
  area public.passage_source not null,
  label text not null,
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (area, label)
);
create index question_types_order_idx on public.question_types (area, archived, position);
create trigger tr_question_types_touch before update on public.question_types
  for each row execute function public.touch_updated_at();

-- 작품(문학) / 제재(독서). genre 는 기존 UNIT_MAJOR_PRESETS 값('문학-현대시' 등)을 그대로 쓴다.
create table public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  genre text,
  era text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index works_title_idx on public.works (archived, title);
create trigger tr_works_touch before update on public.works
  for each row execute function public.touch_updated_at();

-- 기출 출처. label 이 표시명(예: '2024학년도 9월 모평 고3'), 나머지는 정렬·필터용.
create table public.exam_sources (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  year int check (year between 2000 and 2100),
  month int check (month between 1 and 12),
  exam_kind text check (exam_kind in ('수능', '모평', '학평', '사설', '기타')),
  grade int check (grade between 1 and 3),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exam_sources_order_idx on public.exam_sources (archived, year desc, month desc);
create trigger tr_exam_sources_touch before update on public.exam_sources
  for each row execute function public.touch_updated_at();

-- 개념(초점화, 품사 …). body_html 은 허브 페이지의 개념 설명(나중). parent 로 1단계 묶기.
create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  area public.passage_source,
  parent_id uuid references public.concepts(id) on delete set null,
  body_html text,
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index concepts_order_idx on public.concepts (archived, area, position);
create trigger tr_concepts_touch before update on public.concepts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. 지문/문항에 FK
-- ---------------------------------------------------------------------------
alter table public.passages
  add column work_id uuid references public.works(id) on delete set null,
  add column source_id uuid references public.exam_sources(id) on delete set null;
create index passages_work_ref_idx on public.passages (work_id);
create index passages_exam_source_idx on public.passages (source_id);

alter table public.questions
  add column type_id uuid references public.question_types(id) on delete set null;
create index questions_type_idx on public.questions (type_id);

create table public.question_concepts (
  question_id uuid not null references public.questions(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  primary key (question_id, concept_id)
);
create index question_concepts_concept_idx on public.question_concepts (concept_id);

-- 해설 — 제출한 응시가 있는 학생에게만(아래 RLS)
create table public.question_explanations (
  question_id uuid primary key references public.questions(id) on delete cascade,
  body text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger tr_question_explanations_touch before update on public.question_explanations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
alter table public.question_types enable row level security;
alter table public.works enable row level security;
alter table public.exam_sources enable row level security;
alter table public.concepts enable row level security;
alter table public.question_concepts enable row level security;
alter table public.question_explanations enable row level security;

-- 사전 4개: 쓰기는 'passages' 권한, 읽기는 로그인 사용자 누구나(보관 안 된 것). 라벨뿐이라
-- 민감하지 않고, 학생 결과 화면·허브가 라벨을 보여줘야 한다.
create policy "question_types_staff_write" on public.question_types for all to authenticated
  using ((select public.staff_has_permission('passages'))) with check ((select public.staff_has_permission('passages')));
create policy "question_types_read" on public.question_types for select to authenticated
  using (archived = false or (select public.is_admin()));

create policy "works_staff_write" on public.works for all to authenticated
  using ((select public.staff_has_permission('passages'))) with check ((select public.staff_has_permission('passages')));
create policy "works_read" on public.works for select to authenticated
  using (archived = false or (select public.is_admin()));

create policy "exam_sources_staff_write" on public.exam_sources for all to authenticated
  using ((select public.staff_has_permission('passages'))) with check ((select public.staff_has_permission('passages')));
create policy "exam_sources_read" on public.exam_sources for select to authenticated
  using (archived = false or (select public.is_admin()));

create policy "concepts_staff_write" on public.concepts for all to authenticated
  using ((select public.staff_has_permission('passages'))) with check ((select public.staff_has_permission('passages')));
create policy "concepts_read" on public.concepts for select to authenticated
  using (archived = false or (select public.is_admin()));

-- 문항↔개념: 그 문항을 읽을 수 있으면(questions RLS) 연결도 읽는다. 쓰기는 'passages'.
create policy "question_concepts_staff_write" on public.question_concepts for all to authenticated
  using ((select public.staff_has_permission('passages'))) with check ((select public.staff_has_permission('passages')));
create policy "question_concepts_read" on public.question_concepts for select to authenticated
  using (exists (select 1 from public.questions q where q.id = question_concepts.question_id));

-- 해설: 교직원은 passages/tests 권한으로 읽고 passages 로 쓴다. 학생·학부모는
-- 그 문항이 든 시험을 **제출한** 응시가 있을 때만 — 응시 전 유출 방지.
create policy "question_explanations_staff_read" on public.question_explanations for select to authenticated
  using ((select public.staff_has_permission('passages')) or (select public.staff_has_permission('tests')));
create policy "question_explanations_staff_write" on public.question_explanations for insert to authenticated
  with check ((select public.staff_has_permission('passages')));
create policy "question_explanations_staff_update" on public.question_explanations for update to authenticated
  using ((select public.staff_has_permission('passages'))) with check ((select public.staff_has_permission('passages')));
create policy "question_explanations_staff_delete" on public.question_explanations for delete to authenticated
  using ((select public.staff_has_permission('passages')));
create policy "question_explanations_submitted_read" on public.question_explanations for select to authenticated
  using (
    exists (
      select 1
      from public.test_sheet_questions tsq
      join public.test_assignments asg on asg.test_sheet_id = tsq.test_sheet_id
      join public.test_attempts t on t.assignment_id = asg.id and t.status = 'submitted'
      where tsq.question_id = question_explanations.question_id
        and (
          asg.student_id = auth.uid()
          or exists (select 1 from public.parent_student_links psl
                     where psl.parent_id = auth.uid() and psl.student_id = asg.student_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. 유형 시드 — 설계 보고서 부록 A 초안. 원장이 화면에서 고친다.
-- ---------------------------------------------------------------------------
insert into public.question_types (area, label, position) values
  ('reading', '핵심 정보 파악', 0), ('reading', '세부 정보 확인', 1), ('reading', '전개 방식(글의 구조)', 2),
  ('reading', '추론(생략된 정보)', 3), ('reading', '구체적 사례·〈보기〉 적용', 4), ('reading', '비판적 이해', 5),
  ('reading', '어휘(문맥적 의미)', 6),
  ('literature', '표현상 특징', 0), ('literature', '내용(인물·정서) 이해', 1), ('literature', '시어·구절의 의미', 2),
  ('literature', '서술상 특징', 3), ('literature', '외적 준거(〈보기〉) 감상', 4), ('literature', '작품 간 비교', 5),
  ('literature', '갈래 특성', 6),
  ('speech_writing', '말하기 방식', 0), ('speech_writing', '자료 활용', 1), ('speech_writing', '고쳐쓰기', 2),
  ('speech_writing', '조건에 맞는 표현', 3), ('speech_writing', '대화·토의 전략', 4),
  ('language_media', '음운', 0), ('language_media', '품사·단어 형성', 1), ('language_media', '문장(성분·높임·시제)', 2),
  ('language_media', '중세 국어', 3), ('language_media', '매체 특성', 4), ('language_media', '매체 자료 수용·생산', 5);

comment on table public.question_types is '문항 유형 사전(영역별). 원장 관리. 집계 축.';
comment on table public.works is '작품(문학)/제재(독서) 사전. 가이드·허브의 단위.';
comment on table public.exam_sources is '기출 출처 사전. 저작권 출처 표기와도 연결.';
comment on table public.concepts is '개념 사전. 문항 N:M, 허브 노드.';
comment on table public.question_explanations is '문항 해설. 제출한 응시가 있는 학생만 읽음.';
