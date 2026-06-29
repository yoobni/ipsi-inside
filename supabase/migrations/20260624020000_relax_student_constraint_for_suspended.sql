-- ============================================================================
-- student_requires_school_grade 제약 완화
-- 학생 탈퇴 시 PII 마스킹(school/grade NULL)이 가능하도록.
-- approved 상태일 때만 school+grade 필수. suspended/pending/rejected는 우회.
-- ============================================================================

alter table public.profiles
  drop constraint if exists student_requires_school_grade;

alter table public.profiles
  add constraint student_requires_school_grade
  check (
    role <> 'student'
    or status <> 'approved'
    or (school is not null and grade is not null)
  );
