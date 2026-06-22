-- ============================================================================
-- 학습 일지 — 4갈래 입력 구분 (수업/시험/선생님께/새로 알게 된 것)
-- ============================================================================
-- 기존 study_journals.content는 단일 텍스트.
-- 사용자가 4갈래로 입력 분리 요청.

alter table public.study_journals
  add column if not exists class_question text,         -- 수업 내용 질문
  add column if not exists test_question text,           -- 시험 내용 질문
  add column if not exists message_to_teacher text,      -- 선생님께 전달하고 싶은 것
  add column if not exists learning_log text;            -- 오늘 새로 알게 된 것

-- 기존 데이터: content → message_to_teacher (catch-all)
update public.study_journals
  set message_to_teacher = content
  where (message_to_teacher is null or length(trim(message_to_teacher)) = 0)
    and content is not null
    and length(trim(content)) > 0;

-- content NOT NULL 제약 해제 (앞으로는 4갈래만 채워질 수 있음)
alter table public.study_journals alter column content drop not null;
