-- ============================================================================
-- 시험 분석 — attempt_analysis(학생 결과 화면) · sheet_choice_distribution(어드민)
--
-- 학생이 시험을 끝내면 점수만이 아니라 영역·유형·난이도별 정답률, 틀린 문항과
-- 해설, 직전 시험 대비 변화, 최근 90일 반복 취약 영역/유형을 한 번에 본다.
-- 어드민은 문항마다 학생들이 어떤 선지를 골랐는지(①~⑤ 분포)를 본다.
--
-- 둘 다 SECURITY DEFINER + 함수 안 가드(20261008050000 교훈: is_admin() 말고 범위 함수).
--   attempt_analysis: 제출된 응시만. 본인 / 연결 학부모 / 담당 교직원.
--   sheet_choice_distribution: 'tests' 권한 + 담당 학생의 응시만 집계(원장은 전체).
-- 정답·해설이 들어가므로 진행 중 응시에는 절대 돌려주지 않는다.
-- ============================================================================

create or replace function public.attempt_analysis(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with a as (
  select t.id, t.attempt_no, t.score, t.total_points, t.submitted_at, t.status,
         asg.student_id, asg.test_sheet_id, s.title as sheet_title,
         (t.submitted_at at time zone 'Asia/Seoul')::date as d
  from public.test_attempts t
  join public.test_assignments asg on asg.id = t.assignment_id
  join public.test_sheets s on s.id = asg.test_sheet_id
  where t.id = p_attempt_id
),
allowed as (
  select exists (
    select 1 from a
    where a.status = 'submitted'
      and (
        a.student_id = auth.uid()
        or exists (select 1 from public.parent_student_links psl
                   where psl.parent_id = auth.uid() and psl.student_id = a.student_id)
        or public.staff_can_access_student(a.student_id)
      )
  ) as ok
),
-- 이 응시의 문항들 + 내 답
q as (
  select tsq.position, qq.id as question_id, qq.position_in_passage, qq.stem, qq.supplementary,
         qq.choices, qq.correct_answer, qq.points, qq.difficulty, qq.type_id,
         p.title as passage_title, p.source_type::text as source,
         sa.selected, sa.is_correct,
         qt.label as type_label, ex.body as explanation
  from a
  join public.test_sheet_questions tsq on tsq.test_sheet_id = a.test_sheet_id
  join public.questions qq on qq.id = tsq.question_id
  join public.passages p on p.id = qq.passage_id
  left join public.student_answers sa on sa.attempt_id = a.id and sa.question_id = qq.id
  left join public.question_types qt on qt.id = qq.type_id
  left join public.question_explanations ex on ex.question_id = qq.id
),
-- 같은 학생의 다른 시트 최고 응시 중, 이 응시 날짜보다 앞선 가장 최근 것
best_prev as (
  select distinct on (asg.test_sheet_id)
    asg.test_sheet_id, s.title, t.score, t.total_points, t.submitted_at,
    (t.submitted_at at time zone 'Asia/Seoul')::date as d
  from a
  join public.test_assignments asg on asg.student_id = a.student_id and asg.test_sheet_id <> a.test_sheet_id
  join public.test_attempts t on t.assignment_id = asg.id and t.status = 'submitted' and coalesce(t.total_points, 0) > 0
  join public.test_sheets s on s.id = asg.test_sheet_id
  where t.submitted_at < a.submitted_at
  order by asg.test_sheet_id, (t.score::numeric / t.total_points) desc, t.submitted_at desc
),
prev as (
  select * from best_prev order by submitted_at desc limit 1
),
-- 최근 90일 반복 취약: 같은 학생의 시트별 최고 응시 집합(이번 응시 포함)
recent_best as (
  select distinct on (asg.test_sheet_id) t.id as attempt_id, asg.test_sheet_id
  from a
  join public.test_assignments asg on asg.student_id = a.student_id
  join public.test_attempts t on t.assignment_id = asg.id and t.status = 'submitted' and coalesce(t.total_points, 0) > 0
  where (t.submitted_at at time zone 'Asia/Seoul')::date > a.d - 90
    and t.submitted_at <= a.submitted_at
  order by asg.test_sheet_id, (t.score::numeric / t.total_points) desc, t.submitted_at desc
),
recent_q as (
  select p.source_type::text as source, qq.type_id, qt.label as type_label,
         (sa.is_correct is true) as correct
  from recent_best rb
  join public.test_sheet_questions tsq on tsq.test_sheet_id = rb.test_sheet_id
  join public.questions qq on qq.id = tsq.question_id
  join public.passages p on p.id = qq.passage_id
  left join public.question_types qt on qt.id = qq.type_id
  left join public.student_answers sa on sa.attempt_id = rb.attempt_id and sa.question_id = qq.id
)
select case when not (select ok from allowed) then null else jsonb_build_object(
  'attempt', (select jsonb_build_object(
      'id', id, 'attempt_no', attempt_no, 'score', score, 'total_points', total_points,
      'submitted_at', submitted_at, 'sheet_id', test_sheet_id, 'sheet_title', sheet_title,
      'student_id', student_id) from a),
  'previous', (select jsonb_build_object(
      'sheet_id', test_sheet_id, 'title', title, 'date', d, 'score', score, 'total', total_points) from prev),
  'by_area', coalesce((
    select jsonb_agg(jsonb_build_object('source', source, 'total', total, 'correct', correct) order by source)
    from (select source, count(*) total, count(*) filter (where is_correct) correct from q group by source) x
  ), '[]'::jsonb),
  'by_type', coalesce((
    select jsonb_agg(jsonb_build_object('type_id', type_id, 'label', coalesce(type_label, '미분류'), 'total', total, 'correct', correct)
                     order by (type_label is null), type_label)
    from (select type_id, type_label, count(*) total, count(*) filter (where is_correct) correct from q group by type_id, type_label) x
  ), '[]'::jsonb),
  'by_difficulty', coalesce((
    select jsonb_agg(jsonb_build_object('difficulty', coalesce(difficulty, '미지정'), 'total', total, 'correct', correct)
                     order by case difficulty when '상' then 1 when '중' then 2 when '하' then 3 else 4 end)
    from (select difficulty, count(*) total, count(*) filter (where is_correct) correct from q group by difficulty) x
  ), '[]'::jsonb),
  'questions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'position', position, 'question_id', question_id, 'passage_title', passage_title,
      'position_in_passage', position_in_passage, 'stem', stem, 'supplementary', supplementary,
      'choices', choices, 'correct_answer', correct_answer, 'selected', selected,
      'is_correct', is_correct, 'points', points, 'type_label', type_label,
      'difficulty', difficulty, 'source', source, 'explanation', explanation
    ) order by position)
    from q
  ), '[]'::jsonb),
  'recent', jsonb_build_object(
    'window_days', 90,
    'sheets', (select count(*) from recent_best),
    'by_area', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'total', total, 'correct', correct) order by source)
      from (select source, count(*) total, count(*) filter (where correct) correct from recent_q group by source) x
    ), '[]'::jsonb),
    'by_type', coalesce((
      select jsonb_agg(jsonb_build_object('type_id', type_id, 'label', coalesce(type_label, '미분류'), 'total', total, 'correct', correct)
                       order by (type_label is null), type_label)
      from (select type_id, type_label, count(*) total, count(*) filter (where correct) correct from recent_q group by type_id, type_label) x
    ), '[]'::jsonb)
  )
) end
$$;

revoke all on function public.attempt_analysis(uuid) from public, anon;
grant execute on function public.attempt_analysis(uuid) to authenticated;
comment on function public.attempt_analysis(uuid) is
  '제출된 응시 1건의 분석(영역·유형·난이도·문항별+해설·직전 대비·최근 90일 취약). 본인·학부모·담당 교직원만.';

-- 어드민: 문항별 선지 분포. 학생별 **첫 제출 응시** 기준 — 결과를 본 뒤의 재응시는
-- 어떤 오답에 걸리는지를 가리므로 뺀다.
create or replace function public.sheet_choice_distribution(p_sheet_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with allowed as (
  select public.staff_has_permission('tests') as ok
),
first_submitted as (
  select distinct on (asg.id) t.id as attempt_id, asg.student_id
  from public.test_assignments asg
  join public.test_attempts t on t.assignment_id = asg.id and t.status = 'submitted'
  where asg.test_sheet_id = p_sheet_id
    and public.staff_can_access_student(asg.student_id)
  order by asg.id, t.attempt_no asc
),
q as (
  select tsq.position, qq.id as question_id, qq.correct_answer, qq.position_in_passage,
         p.title as passage_title, qt.label as type_label, qq.difficulty
  from public.test_sheet_questions tsq
  join public.questions qq on qq.id = tsq.question_id
  join public.passages p on p.id = qq.passage_id
  left join public.question_types qt on qt.id = qq.type_id
  where tsq.test_sheet_id = p_sheet_id
),
dist as (
  select q.question_id,
         count(fs.attempt_id)                                  as total,
         count(*) filter (where sa.selected = 1)               as c1,
         count(*) filter (where sa.selected = 2)               as c2,
         count(*) filter (where sa.selected = 3)               as c3,
         count(*) filter (where sa.selected = 4)               as c4,
         count(*) filter (where sa.selected = 5)               as c5,
         count(*) filter (where fs.attempt_id is not null and sa.selected is null) as unanswered,
         count(*) filter (where sa.is_correct)                 as correct
  from q
  left join first_submitted fs on true
  left join public.student_answers sa on sa.attempt_id = fs.attempt_id and sa.question_id = q.question_id
  group by q.question_id
)
select case when not (select ok from allowed) then null else jsonb_build_object(
  'sheet_id', p_sheet_id,
  'respondents', (select count(*) from first_submitted),
  'questions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'position', q.position, 'question_id', q.question_id, 'passage_title', q.passage_title,
      'position_in_passage', q.position_in_passage, 'type_label', q.type_label, 'difficulty', q.difficulty,
      'correct_answer', q.correct_answer,
      'total', d.total, 'correct', d.correct, 'unanswered', d.unanswered,
      'counts', jsonb_build_array(d.c1, d.c2, d.c3, d.c4, d.c5)
    ) order by q.position)
    from q join dist d on d.question_id = q.question_id
  ), '[]'::jsonb)
) end
$$;

revoke all on function public.sheet_choice_distribution(uuid) from public, anon;
grant execute on function public.sheet_choice_distribution(uuid) to authenticated;
comment on function public.sheet_choice_distribution(uuid) is
  '시트 문항별 선지 분포(학생별 첫 제출 응시). tests 권한, 조교는 담당 학생만 집계.';
