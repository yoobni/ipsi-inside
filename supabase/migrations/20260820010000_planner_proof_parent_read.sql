-- ============================================================================
-- planner-proofs 버킷 — 학부모의 자녀 인증사진 열람 정책
--
-- 20260820000000 에서는 '본인 폴더'(= auth.uid())만 select 되게 깔았는데,
-- 플래너 화면은 학부모도 열람 대상이라(자녀 체크·사유가 이미 보임) 사진만
-- 403이 되어 깨진다. 경로 첫 폴더가 '내 자녀'일 때 select를 허용한다.
--
-- insert/delete는 늘리지 않는다 — 사진을 올리고 지우는 건 학생 본인만.
-- ============================================================================
create policy "planner_proofs_parent_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'planner-proofs'
    and exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = auth.uid()
        and psl.student_id::text = (storage.foldername(name))[1]
    )
  );
