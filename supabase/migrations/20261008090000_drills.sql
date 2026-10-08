-- ============================================================================
-- OX · 짧은 인터랙티브 훈련 (drills)
--
-- 시험과 별개로 5~10문항을 짧게 반복하는 훈련. 1차 3종: ox(O/X), choice(보기 선택),
-- classify(분류 — 품사처럼 토큰을 바구니에 넣기). 틀린 항목은 즉시 재출제(클라이언트가
-- 큐에 다시 넣고 retry_no로 기록).
--
-- 정답·해설은 **RPC로만** 나간다. questions.correct_answer 가 배정 학생에게 그대로
-- 읽히는 틈을 여기선 반복하지 않는다: drill_items 에 학생 select 정책이 없고,
-- 풀이용 항목은 drill_play()가 answer 를 뺀 채 돌려주며, 채점은 submit_drill_answer()
-- SECURITY DEFINER 가 한다.
--
-- 성취도 연결: drill_item_results × drill_concepts 로 개념별 정답률(⑩ 취약점)에 쓴다.
-- ============================================================================

create table public.drills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null check (kind in ('ox', 'choice', 'classify')),
  area public.passage_source,
  work_id uuid references public.works(id) on delete set null,
  time_limit_sec int check (time_limit_sec between 3 and 300),
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drills_published_idx on public.drills (is_published, published_at desc);
create index drills_work_idx on public.drills (work_id);
create trigger tr_drills_touch before update on public.drills
  for each row execute function public.touch_updated_at();

create table public.drill_concepts (
  drill_id uuid not null references public.drills(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  primary key (drill_id, concept_id)
);

-- payload / answer 는 kind 별:
--   ox       payload {}                              answer {value: bool}
--   choice   payload {options: string[]}             answer {index: int}
--   classify payload {buckets: string[], tokens: string[]}  answer {assignments: int[]} (토큰 i → 바구니)
create table public.drill_items (
  id uuid primary key default gen_random_uuid(),
  drill_id uuid not null references public.drills(id) on delete cascade,
  position int not null,
  prompt text not null,
  payload jsonb not null default '{}'::jsonb,
  answer jsonb not null,
  explanation text,
  created_at timestamptz not null default now()
);
create index drill_items_drill_idx on public.drill_items (drill_id, position);

create table public.drill_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  drill_id uuid not null references public.drills(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  correct int,
  total int
);
create index drill_attempts_student_idx on public.drill_attempts (student_id, started_at desc);
create index drill_attempts_drill_idx on public.drill_attempts (drill_id);

create table public.drill_item_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.drill_attempts(id) on delete cascade,
  item_id uuid not null references public.drill_items(id) on delete cascade,
  retry_no int not null default 1,
  correct boolean not null,
  elapsed_ms int,
  answered_at timestamptz not null default now()
);
create index drill_item_results_attempt_idx on public.drill_item_results (attempt_id, item_id, retry_no);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.drills enable row level security;
alter table public.drill_concepts enable row level security;
alter table public.drill_items enable row level security;
alter table public.drill_attempts enable row level security;
alter table public.drill_item_results enable row level security;

-- 콘텐츠 작성은 'passages'(지문/문항과 같은 콘텐츠 권한)
create policy "drills_staff_write" on public.drills for all to authenticated
  using ((select public.staff_has_permission('passages'))) with check ((select public.staff_has_permission('passages')));
-- 학생·학부모: 발행된 훈련 목록(메타)만
create policy "drills_published_read" on public.drills for select to authenticated
  using (is_published and (published_at is null or published_at <= now()));

create policy "drill_concepts_staff_write" on public.drill_concepts for all to authenticated
  using ((select public.staff_has_permission('passages'))) with check ((select public.staff_has_permission('passages')));
create policy "drill_concepts_read" on public.drill_concepts for select to authenticated
  using (exists (select 1 from public.drills d where d.id = drill_concepts.drill_id));

-- 항목: 교직원만 직접 읽고 쓴다. 학생은 drill_play()(answer 제외)로만.
create policy "drill_items_staff_all" on public.drill_items for all to authenticated
  using ((select public.staff_has_permission('passages'))) with check ((select public.staff_has_permission('passages')));

-- 응시: 본인·학부모 읽기, 교직원은 담당 학생. 쓰기는 RPC(definer)만 — 학생 insert/update 정책 없음.
create policy "drill_attempts_self_read" on public.drill_attempts for select to authenticated
  using (student_id = auth.uid()
      or exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = drill_attempts.student_id));
create policy "drill_attempts_staff_read" on public.drill_attempts for select to authenticated
  using ((select public.is_owner()) or public.staff_can_access_student(student_id));

create policy "drill_item_results_self_read" on public.drill_item_results for select to authenticated
  using (exists (select 1 from public.drill_attempts a where a.id = drill_item_results.attempt_id
                 and (a.student_id = auth.uid()
                      or exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = a.student_id))));
create policy "drill_item_results_staff_read" on public.drill_item_results for select to authenticated
  using (exists (select 1 from public.drill_attempts a where a.id = drill_item_results.attempt_id
                 and ((select public.is_owner()) or public.staff_can_access_student(a.student_id))));

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------
-- 풀이용 항목 — answer 없이. 발행된 훈련은 로그인 사용자 누구나, 미발행은 교직원 미리보기.
create or replace function public.drill_play(p_drill_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (
      select 1 from public.drills d
      where d.id = p_drill_id
        and ((d.is_published and (d.published_at is null or d.published_at <= now()))
             or public.is_admin())
    ) then null
    else (
      select jsonb_build_object(
        'drill', jsonb_build_object('id', d.id, 'title', d.title, 'description', d.description,
                                    'kind', d.kind, 'time_limit_sec', d.time_limit_sec),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('id', i.id, 'position', i.position, 'prompt', i.prompt, 'payload', i.payload) order by i.position)
          from public.drill_items i where i.drill_id = d.id
        ), '[]'::jsonb)
      )
      from public.drills d where d.id = p_drill_id
    )
  end
$$;
revoke all on function public.drill_play(uuid) from public, anon;
grant execute on function public.drill_play(uuid) to authenticated;

-- 응시 시작 — 승인된 학생만, 발행된 훈련만
create or replace function public.start_drill_attempt(p_drill_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_total int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'student' and status = 'approved') then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.drills d where d.id = p_drill_id and d.is_published and (d.published_at is null or d.published_at <= now())) then
    raise exception 'drill not available';
  end if;
  select count(*) into v_total from public.drill_items where drill_id = p_drill_id;
  if v_total = 0 then raise exception 'drill has no items'; end if;
  insert into public.drill_attempts (student_id, drill_id, total) values (auth.uid(), p_drill_id, v_total) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.start_drill_attempt(uuid) from public, anon;
grant execute on function public.start_drill_attempt(uuid) to authenticated;

-- 채점 — 본인의 끝나지 않은 응시만. 정답·해설은 채점 뒤에만 돌려준다.
create or replace function public.submit_drill_answer(
  p_attempt_id uuid, p_item_id uuid, p_answer jsonb, p_elapsed_ms int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text; v_answer jsonb; v_expl text; v_correct boolean; v_retry int;
begin
  if not exists (
    select 1 from public.drill_attempts a
    join public.drill_items i on i.id = p_item_id and i.drill_id = a.drill_id
    where a.id = p_attempt_id and a.student_id = auth.uid() and a.finished_at is null
  ) then
    raise exception 'forbidden';
  end if;

  select d.kind, i.answer, i.explanation into v_kind, v_answer, v_expl
  from public.drill_items i join public.drills d on d.id = i.drill_id
  where i.id = p_item_id;

  v_correct := case
    when p_answer ? 'timeout' then false
    when v_kind = 'ox' then (p_answer->>'value')::boolean is not distinct from (v_answer->>'value')::boolean
    when v_kind = 'choice' then (p_answer->>'index')::int is not distinct from (v_answer->>'index')::int
    when v_kind = 'classify' then (p_answer->'assignments') = (v_answer->'assignments')
    else false
  end;

  select coalesce(max(retry_no), 0) + 1 into v_retry
  from public.drill_item_results where attempt_id = p_attempt_id and item_id = p_item_id;

  insert into public.drill_item_results (attempt_id, item_id, retry_no, correct, elapsed_ms)
  values (p_attempt_id, p_item_id, v_retry, v_correct, p_elapsed_ms);

  return jsonb_build_object('correct', v_correct, 'answer', v_answer, 'explanation', v_expl, 'retry_no', v_retry);
end;
$$;
revoke all on function public.submit_drill_answer(uuid, uuid, jsonb, int) from public, anon;
grant execute on function public.submit_drill_answer(uuid, uuid, jsonb, int) to authenticated;

-- 종료 — 첫 시도에 맞힌 항목 수가 점수. 틀렸던 항목 id 목록을 돌려준다(다시 풀기용).
create or replace function public.finish_drill_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_correct int; v_total int; v_wrong uuid[];
begin
  if not exists (select 1 from public.drill_attempts a where a.id = p_attempt_id and a.student_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  select count(*) filter (where first_ok), count(*)
    into v_correct, v_total
  from (
    select i.id,
           bool_or(r.correct) filter (where r.retry_no = 1) as first_ok
    from public.drill_attempts a
    join public.drill_items i on i.drill_id = a.drill_id
    left join public.drill_item_results r on r.attempt_id = a.id and r.item_id = i.id
    where a.id = p_attempt_id
    group by i.id
  ) x;
  select coalesce(array_agg(i.id order by i.position), '{}') into v_wrong
  from public.drill_attempts a
  join public.drill_items i on i.drill_id = a.drill_id
  where a.id = p_attempt_id
    and not exists (select 1 from public.drill_item_results r where r.attempt_id = a.id and r.item_id = i.id and r.retry_no = 1 and r.correct);

  update public.drill_attempts
     set finished_at = coalesce(finished_at, now()), correct = v_correct, total = v_total
   where id = p_attempt_id;

  return jsonb_build_object('correct', v_correct, 'total', v_total, 'wrong_item_ids', to_jsonb(v_wrong));
end;
$$;
revoke all on function public.finish_drill_attempt(uuid) from public, anon;
grant execute on function public.finish_drill_attempt(uuid) to authenticated;

comment on table public.drills is 'OX·보기선택·분류 훈련. 발행된 것만 학생에게. 항목 정답은 RPC로만.';
