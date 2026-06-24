-- ============================================================================
-- 동의 timestamp — 가입 시점에 이용약관/개인정보처리방침/마케팅 수신 동의 기록
-- ============================================================================

alter table public.profiles
  add column if not exists terms_agreed_at timestamptz,
  add column if not exists privacy_agreed_at timestamptz,
  add column if not exists marketing_agreed_at timestamptz;
