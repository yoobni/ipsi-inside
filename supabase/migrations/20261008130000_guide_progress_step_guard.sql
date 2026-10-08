-- 가이드 진도 insert 가드 보강: step_id 가 같은 guide_id 에 속해야 한다.
-- (클라가 보낸 guide_id/step_id 조합을 믿지 않는다 — 어긋나면 진도 수가 부풀 수 있었다)
drop policy if exists "guide_progress_student_insert" on public.guide_progress;
create policy "guide_progress_student_insert" on public.guide_progress for insert to authenticated
  with check (student_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'approved')
    and exists (select 1 from public.guides g where g.id = guide_progress.guide_id and g.status = 'published')
    and exists (select 1 from public.guide_steps s where s.id = guide_progress.step_id and s.guide_id = guide_progress.guide_id));
