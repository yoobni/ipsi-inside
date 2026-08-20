-- ============================================================================
-- profiles.must_change_password — 원장이 발급한 임시 비밀번호 강제 변경 플래그
--
-- 이 서비스는 원장 승인이 게이트인 폐쇄형이고, 가입 시 이메일을 실제로
-- 검증하지 않는다(`email_confirm: true`로 자동 확인). 그래서 메일 기반
-- 재설정은 오타 주소를 적은 학생을 영구히 잠기게 만든다.
--
-- 대신 원장이 임시 비밀번호를 발급해 전달하는 방식을 쓴다. 다만 원장이 아는
-- 비밀번호가 그대로 남으면 안 되므로, 발급 시 이 플래그를 세우고 학생이
-- 새 비밀번호로 바꿀 때까지 다른 화면을 못 쓰게 막는다.
-- ============================================================================
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  '원장이 임시 비밀번호를 발급한 상태. true면 본인이 변경할 때까지 다른 화면 접근 차단';
