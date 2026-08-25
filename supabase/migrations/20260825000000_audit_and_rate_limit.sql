-- ============================================================================
-- 안전성 확보조치 — 접속기록 보관(A-2) + 인증 시도 제한(A-1)
--
-- 「개인정보의 안전성 확보조치 기준」 고시가 요구하는 두 가지를 채운다.
--   1. 개인정보취급자(원장)의 접속기록을 남기고 1년 이상 보관한다 (제8조)
--   2. 일정 횟수 이상 인증에 실패하면 접근을 제한한다 (접근 통제)
--
-- 둘 다 외부 서비스 없이 이 DB 안에서 끝낸다. 로그인·가입은 분당 수 건
-- 수준이라 Redis를 따로 둘 이유가 없고, 운영 대상이 하나 늘면 그만큼
-- 안 돌아가는 날이 생긴다 (rate-limit이 placeholder로 남아 있던 이유이기도 하다).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- admin_access_logs — 누가 언제 어떤 개인정보에 닿았는가
--
-- 쓰기 정책을 두지 않는 건 consent_records와 같은 이유다: 기록 주체가
-- 기록을 고칠 수 있으면 증적이 아니다. 쓰기는 service_role만 한다.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_access_logs (
  id uuid primary key default gen_random_uuid(),
  -- 계정이 지워져도 기록은 남아야 한다 → cascade 아님
  actor_id uuid references public.profiles(id) on delete set null,
  -- 'member.view' | 'member.export' | 'attendance.export' | 'test.export'
  -- | 'password.issue' | 'member.approve' | 'member.reject' | 'proof.view'
  action text not null,
  target_type text,
  target_id uuid,
  -- 범위형 반출(기간·건수)처럼 target_id로 표현 못 하는 맥락
  detail jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists admin_access_logs_created_idx
  on public.admin_access_logs (created_at desc);
create index if not exists admin_access_logs_actor_idx
  on public.admin_access_logs (actor_id, created_at desc);
create index if not exists admin_access_logs_target_idx
  on public.admin_access_logs (target_id, created_at desc);

alter table public.admin_access_logs enable row level security;

-- 열람은 관리자만. insert/update/delete 정책은 의도적으로 없다.
create policy "admin_access_logs_select_admin"
  on public.admin_access_logs for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- rate_limit_hits — 고정 윈도우 카운터
--
-- bucket = '{name}:{key}' (예: 'login:1.2.3.4:a@b.com').
-- 슬라이딩 윈도우가 더 정확하지만, 무차별 대입을 늦추는 목적엔 고정
-- 윈도우로 충분하고 행 하나로 끝나 경합이 없다.
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_hits (
  bucket text primary key,
  count int not null,
  window_started_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_window_idx
  on public.rate_limit_hits (window_started_at);

-- 정책 없이 RLS만 켠다 = service_role 외 접근 불가
alter table public.rate_limit_hits enable row level security;

-- ---------------------------------------------------------------------------
-- consume_rate_limit — 한 번 호출 = 한 번 시도. 원자적으로 세고 판정한다.
--
-- 읽고-판단하고-쓰면 동시 요청이 같은 잔여치를 보고 함께 통과한다.
-- upsert 한 문장에서 증가와 판정을 끝내야 그 창이 닫힌다.
-- ---------------------------------------------------------------------------
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_limit int,
  p_window_sec int
)
returns table (allowed boolean, retry_after_sec int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(secs => p_window_sec);
  v_count int;
  v_started timestamptz;
begin
  insert into public.rate_limit_hits as r (bucket, count, window_started_at)
  values (p_bucket, 1, v_now)
  on conflict (bucket) do update
    set count = case
          when r.window_started_at + v_window <= v_now then 1
          else r.count + 1
        end,
        window_started_at = case
          when r.window_started_at + v_window <= v_now then v_now
          else r.window_started_at
        end
  returning r.count, r.window_started_at into v_count, v_started;

  if v_count > p_limit then
    return query
      select
        false,
        greatest(
          1,
          ceil(extract(epoch from (v_started + v_window) - v_now))::int
        );
  else
    return query select true, 0;
  end if;
end;
$$;

-- 클라이언트가 직접 부르면 남의 버킷을 소진시켜 로그인을 막을 수 있다.
revoke all on function public.consume_rate_limit(text, int, int) from public;
revoke all on function public.consume_rate_limit(text, int, int) from anon;
revoke all on function public.consume_rate_limit(text, int, int) from authenticated;

-- ---------------------------------------------------------------------------
-- 만료 버킷 청소 — 카운터는 지나면 쓸모가 없다.
-- 크론을 하나 더 두느니 로그인 액션이 가끔 쓸어내게 한다.
-- ---------------------------------------------------------------------------
create or replace function public.prune_rate_limit_hits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limit_hits
  where window_started_at < now() - interval '1 day';
$$;

revoke all on function public.prune_rate_limit_hits() from public;
revoke all on function public.prune_rate_limit_hits() from anon;
revoke all on function public.prune_rate_limit_hits() from authenticated;

-- ---------------------------------------------------------------------------
-- 접속기록 보관기간 — 고시는 최소 1년을 요구한다. 그보다 오래된 것은
-- 보관 목적이 끝났으므로 지운다(개인정보 최소 보유 원칙).
-- 지금은 수동 호출용. 건수가 늘면 Vercel Cron에 붙인다.
-- ---------------------------------------------------------------------------
create or replace function public.prune_admin_access_logs()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.admin_access_logs
  where created_at < now() - interval '13 months';
$$;

revoke all on function public.prune_admin_access_logs() from public;
revoke all on function public.prune_admin_access_logs() from anon;
revoke all on function public.prune_admin_access_logs() from authenticated;
