-- ============================================================================
-- 동의 이력 (append-only)
--
-- profiles.{terms,privacy,marketing}_agreed_at 만으로는 부족했다:
--   1) 동의한 **문서의 버전**이 없다 → 약관을 한 번 고치면 이 회원이 무엇에
--      동의했는지 증명할 수 없다
--   2) 철회 이력이 남지 않는다 → 마케팅 수신을 껐다 켠 흔적이 사라진다
--   3) "개인정보처리방침에 동의" 한 칸으로 이용약관 동의와 수집·이용 동의를
--      뭉쳐놨다. 법 제15조의 수집·이용 동의는 별개 항목이다
--
-- 그래서 행을 지우거나 고치지 않고 쌓는다. 현재 상태는 kind별 최신 행이다.
-- profiles의 timestamp 컬럼은 빠른 조회를 위한 비정규화 사본으로 유지한다.
-- ============================================================================

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- terms: 이용약관 / privacy: 개인정보 수집·이용 / age14: 만 14세 이상 확인
  -- child_info: 자녀 개인정보 제공(학부모) / marketing: 광고성 정보 수신(선택)
  kind text not null
    check (kind in ('terms', 'privacy', 'age14', 'child_info', 'marketing')),
  -- 동의 시점에 화면에 떠 있던 문서 버전. 문서를 고치면 올린다.
  doc_version text not null,
  -- false = 미동의 또는 철회. 철회도 이력이므로 행으로 남긴다.
  agreed boolean not null,
  agreed_at timestamptz not null default now(),
  -- 증적: 어디서 눌렀는지. 분쟁 시 동의 사실을 뒷받침한다.
  ip inet,
  user_agent text
);

create index consent_records_user_kind_idx
  on public.consent_records (user_id, kind, agreed_at desc);

alter table public.consent_records enable row level security;

-- 본인은 자기 동의 이력을 열람할 수 있다 (법 제35조 열람권).
create policy "consent_records_select_self"
  on public.consent_records for select
  to authenticated
  using (user_id = auth.uid());

create policy "consent_records_select_admin"
  on public.consent_records for select
  to authenticated
  using (public.is_admin());

-- insert/update/delete 정책은 **의도적으로 없다**.
--
-- 동의 기록은 클라이언트가 직접 쓸 수 있으면 증적으로서의 가치가 없다.
-- 쓰기는 서버(서버 액션 + service_role)만 한다. RLS 기본 거부에 맡긴다.
