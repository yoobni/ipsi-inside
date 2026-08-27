-- ============================================================================
-- Q&A — 일지(매일 피드백)와 분리된 독립 질의응답
--
-- 일지의 질문 4갈래는 "그날 공부에 대한 피드백"이 목적이라 그대로 둔다.
-- Q&A는 수업·교재 문제를 즉시 물어보는 별도 창구다. 질문 데이터가 규격화돼
-- 쌓이면 나중에 Best 오답 문항 추출·AI 컨텍스트로 재활용하기 좋다.
--
-- 답변은 초안(ai_draft) → 원장 검수 → 발행 흐름을 담을 수 있게 별도 테이블.
-- AI 생성은 지금 붙이지 않는다(ai_draft 컬럼과 어댑터 자리만 둔다).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- qna_categories — 질문 분류 + 가이드라인(placeholder). 원장이 관리.
--
-- placeholder를 카테고리별로 두는 건, "이 문제 왜 틀렸는지 모르겠어요" 같은
-- 모호한 질문을 줄이려는 것이다. 원장이 좋은 질문의 예시 문구를 직접 넣는다.
-- ---------------------------------------------------------------------------
create table public.qna_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null,                    -- '학습' / '수업' / '숙제' / '일상'
  placeholder text,                       -- 질문 입력창 안내 문구 (원장이 구성)
  needs_reference boolean not null default false,  -- true면 교재/문항 참조 입력 권장
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index qna_categories_order_idx
  on public.qna_categories (archived, position, created_at);

create trigger tr_qna_categories_touch
  before update on public.qna_categories
  for each row execute function public.touch_updated_at();

-- 시드 — 원장이 화면에서 수정/추가/보관한다.
insert into public.qna_categories (label, placeholder, needs_reference, position) values
  ('학습', '예) 오늘 배운 ''논증 구조''에서 전제와 결론을 접속어 유무로 구분하는 게 맞는지 헷갈려요.', false, 0),
  ('수업', '예) 지난 수업에서 다룬 ''단서 문장'' 개념이 비문학 어디에 적용되는지 다시 설명해주실 수 있나요?', false, 1),
  ('숙제', '예) 주간지 3호 12번, ②번 보기가 틀린 이유가 3문단 때문인지 확실하지 않아요.', true, 2),
  ('일상', '예) 국어 공부 시간 배분이 잘 안 돼요. 하루 루틴 조언 부탁드려요.', false, 3);

-- ---------------------------------------------------------------------------
-- qna_questions — 학생 질문
-- ---------------------------------------------------------------------------
create table public.qna_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  -- 카테고리가 삭제돼도 질문은 남아야 한다 → set null
  category_id uuid references public.qna_categories(id) on delete set null,
  -- 교재/시험지 규격화: "주간지 3호" "6월 모의고사" 등 + 문항 번호
  reference_label text,                   -- 교재/시험지
  question_no text,                       -- 문항 번호
  body text not null,
  image_path text,                        -- qna-images 버킷 키 (선택 첨부)
  status text not null default 'open'
    check (status in ('open', 'answered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index qna_questions_student_idx
  on public.qna_questions (student_id, created_at desc);
create index qna_questions_status_idx
  on public.qna_questions (status, created_at desc);

create trigger tr_qna_questions_touch
  before update on public.qna_questions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- qna_answers — 원장 답변 (질문당 1개). 초안↔발행.
--   ai_draft   : AI가 생성한 초안 (지금은 미사용, 컬럼만)
--   body       : 원장이 검수/작성한 최종 답변
--   published_at: null=검수 중(학생에게 안 보임), 값=발행
-- ---------------------------------------------------------------------------
create table public.qna_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.qna_questions(id) on delete cascade,
  ai_draft text,
  body text not null,
  answered_by uuid references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tr_qna_answers_touch
  before update on public.qna_answers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.qna_categories enable row level security;
alter table public.qna_questions enable row level security;
alter table public.qna_answers enable row level security;

-- 카테고리: 관리자 전권, 인증 사용자는 살아있는 것만 read
create policy "qna_categories_admin_all"
  on public.qna_categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy "qna_categories_read"
  on public.qna_categories for select
  to authenticated
  using (archived = false or public.is_admin());

-- 질문: 관리자 전권
create policy "qna_questions_admin_all"
  on public.qna_questions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- 학생 본인이 작성 (승인 상태에서만)
create policy "qna_questions_student_insert"
  on public.qna_questions for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'student' and p.status = 'approved'
    )
  );
-- 학생 본인 질문 read
create policy "qna_questions_student_select"
  on public.qna_questions for select
  to authenticated
  using (student_id = auth.uid());
-- 학생 본인이 아직 답변 전(open)일 때만 수정/삭제
create policy "qna_questions_student_update"
  on public.qna_questions for update
  to authenticated
  using (student_id = auth.uid() and status = 'open')
  with check (student_id = auth.uid() and status = 'open');
create policy "qna_questions_student_delete"
  on public.qna_questions for delete
  to authenticated
  using (student_id = auth.uid() and status = 'open');

-- 답변: 관리자 전권
create policy "qna_answers_admin_all"
  on public.qna_answers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- 학생은 자기 질문의 답변 중 '발행된 것'만 read (초안·검수 중은 안 보임)
create policy "qna_answers_student_select"
  on public.qna_answers for select
  to authenticated
  using (
    published_at is not null
    and published_at <= now()
    and exists (
      select 1 from public.qna_questions q
       where q.id = qna_answers.question_id and q.student_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- qna-images 버킷 — 학생이 질문에 붙이는 사진 (지문에 표시한 흔적 등)
--   planner-proofs와 같은 패턴: 학생이 자기 폴더에만 insert, 관리자 전체 select.
--   Q&A는 학생-원장 소통이라 학부모는 제외한다.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qna-images', 'qna-images', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "qna_images_admin_all"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'qna-images' and public.is_admin())
  with check (bucket_id = 'qna-images' and public.is_admin());

create policy "qna_images_student_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'qna-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "qna_images_student_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'qna-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "qna_images_student_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'qna-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
