-- ============================================================================
-- Q&A 좋은 질문 선정 — 원장 전용 북마크
--
-- 원장이 학생 질문을 보다가 "좋은 질문"이라 판단하면 ★ 한 번으로 모아 둔다.
-- 당장 학생에게 공개하지 않는다. 축적해서 나중에 콘텐츠·수업 자료로 쓰려는 것.
--
-- qna_questions에 boolean 컬럼을 두지 않는 이유:
--   - qna_questions_student_select 가 전 컬럼을 돌려줘서 학생에게 플래그가 보인다.
--   - qna_questions_student_update 가 open 상태의 본인 행을 아무 컬럼이나 고칠 수
--     있어서 학생이 스스로 선정할 수 있다.
-- 별도 테이블 + is_admin() 정책만 두면 학생 쪽 GRANT를 손대지 않고 완전히 숨긴다.
-- ============================================================================

create table public.qna_question_stars (
  question_id uuid primary key references public.qna_questions(id) on delete cascade,
  starred_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index qna_question_stars_created_idx
  on public.qna_question_stars (created_at desc);

alter table public.qna_question_stars enable row level security;

-- 관리자 전권. 학생 정책은 일부러 없다(읽기도 쓰기도 불가).
create policy "qna_question_stars_admin_all"
  on public.qna_question_stars for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 탈퇴(withdrawAction)가 qna_questions 를 삭제하면 선정 기록도 cascade 로
-- 함께 사라진다. 처리방침 §6 "Q&A 파기"와 일치하는 동작이라 의도된 것.
comment on table public.qna_question_stars is
  '원장이 선정한 좋은 질문. 학생에게 노출 안 함. 질문 삭제 시 함께 삭제.';
