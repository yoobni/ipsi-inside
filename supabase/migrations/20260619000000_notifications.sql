-- ============================================================================
-- In-app notifications (이메일/FCM 없이 사이트 내 종 아이콘만)
-- ============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,                -- 'test_assigned' | 'test_submitted' | 'journal_submitted' | 'journal_feedback_published'
  title text not null,
  body text,
  link text,                          -- 클릭 시 이동할 in-app URL (예: '/dashboard/tests/<id>')
  read_at timestamptz,                -- null이면 미읽음
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.notifications enable row level security;

create policy "notifications_self_read"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications_self_update"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- admin (또는 service role이 들어간 server action)가 다른 사용자에게 알림 insert
create policy "notifications_admin_all"
  on public.notifications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 학생/학부모도 자기/연결 학생 액션을 일으킬 때 알림을 insert할 수 있어야 함:
--  - 학생이 시험 제출 → admin에게 알림
--  - 학생이 일지 제출 → admin에게 알림
-- 이 케이스는 student_id = auth.uid() 인 행을 트리거로 만들거나 server action에서 admin 대상으로 insert해야 함.
-- 가장 안전: 사용자가 자기 자신에게는 insert 가능, 그리고 admin 대상 insert를 위해 별도 정책을 둔다.
create policy "notifications_self_insert"
  on public.notifications for insert
  to authenticated
  with check (user_id = auth.uid());

-- 학생/학부모가 admin에게 알림 (시험/일지 제출) — 본인이 발생시킨 이벤트인지 검증은 server action 단에서.
create policy "notifications_to_admin"
  on public.notifications for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = notifications.user_id and p.role = 'admin'
    )
  );
