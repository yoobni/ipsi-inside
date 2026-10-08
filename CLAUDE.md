# 입시 인사이드 (ipsi-inside) — 작업 가이드

폐쇄형(원장 승인제) 온라인 학원 관리 사이트. 학생·학부모·원장 3역할.
수능 국어 특화 — 주간 플래너, 학습 일지, 시험 자동채점, 자료 배부, 칼럼, Q&A.

> 앱별 빌드 규칙은 `apps/web/AGENTS.md`·`apps/admin/AGENTS.md`에 있다. 이 문서는
> 저장소 전체에 걸친 규칙과, 대화로 굳어진 합의를 모은다.

---

## 0. 일하는 방식 — 먼저 지킬 것

- **커밋·푸시는 명시적으로 시켰을 때만 한다.** "고쳐줘"·"만들어줘"·"이어서 해줘"는
  작업 지시일 뿐 커밋 지시가 아니다. 코드리뷰 반영·버그 수정도 마찬가지 —
  올리라는 말이 없으면 워킹트리에만 두고 멈춘다. 되돌리기 힘든 행동(커밋/푸시/
  force/삭제/외부 전송)은 별도 확인을 받는다.
- 작업은 요청 범위대로. 임의로 넓히거나 좁히지 않는다. 애매하면 합리적 기본값을
  택해 진행하고 무엇을 가정했는지 밝힌다. 판단이 갈리는 지점만 물어본다.
- 다른 에이전트(코드리뷰 등)의 지적은 **검증되지 않은 주장**으로 받는다. 반영하기
  전에 코드로 확인하거나 최소한 근거를 따진다.

## 1. 스택 · 구조

- 모노레포: pnpm + Turborepo. Node ≥ 20.
- `apps/web` — 학생·학부모. `apps/admin` — 원장(별도 앱).
- `packages/` — `types`(zod 스키마·상수·`findOverlap`·`sanitizeRichHtml` 호출부),
  `lib`(supabase 클라이언트·env·errors·rate-limit·audit·turnstile·sanitize),
  `db`(생성 타입).
- Next.js **16** (App Router). React 19, Tailwind v4, Supabase(RLS 강제).
- 미들웨어는 `middleware.ts`가 아니라 **`proxy.ts`** 컨벤션.
- 백엔드는 전부 Server Action + Route Handler (NestJS 미도입).
- 두 앱이 같은 Supabase 프로젝트 공유 — `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE_NAME`으로
  세션 격리(web=`sb-web-auth-token`, admin=`sb-admin-auth-token`).

## 2. 로컬 · 배포

- dev 포트 고정: **web=1234, admin=2345**. 3000 금지.
- **Next.js 16은 학습 데이터와 다르다.** 코드 쓰기 전 `node_modules/next/dist/docs/`의
  해당 가이드를 먼저 읽는다(모노레포라 `next`가 루트에서 안 보일 수 있음).
- 마이그레이션은 **psql로 직접 적용**한다(Supabase CLI 로그인 막힘, schema_migrations
  추적 없음). pooler 6543 + `-1`(단일 트랜잭션). 접속정보는 로컬 메모리 참조.
- **push 전 `pnpm build` 양쪽 통과 확인.** dev(Turbopack)는 타입체크를 안 한다.
  `curl 200`·"Compiled" 메시지를 검증으로 삼지 말 것.
- **push 전 `gh auth switch -u yoobni`.** 안 하면 handys-ravi로 403.
- Vercel 자동 배포(web/admin rootDirectory 분리).
- 점검 모드: web env `MAINTENANCE_MODE=1` → 학생/학부모 503, admin은 그대로.

## 3. 데이터 · RLS 원칙

- `public` 스키마의 **모든 민감 테이블에 RLS 활성**. 교직원은 **원장(owner)/조교(assistant)**
  로 나뉜다(`profiles.role='admin'` + `admin_level`). `is_admin()`은 "승인된 교직원 전체",
  정책은 `(select is_owner()) or (staff_has_permission('키') and staff_can_access_student(id))`
  꼴로 좁힌다. 권한 키·메뉴·라우트 규칙은 `packages/types/src/staff.ts` 한 곳.
  조교 범위는 `staff_settings.scope_mode`(all/scoped) + `staff_student_scope`/`staff_group_scope`
  — scoped+0명=아무도 못 봄(실패 시 닫힘). 원장 전용: 가입승인·접속기록·조교관리·CSV·회원 계정 조작.
- **service_role(RLS 우회)은 서버에서만.** 브라우저 노출 금지. 서버 액션에서 쓸 때는
  앞단에 권한 검증(`ensureStaff({permission, studentIds})` / `ensureOwner()`)을 둔다 —
  RLS만 믿지 않는 방어심층화. 대상 행은 **세션 클라이언트로 먼저 읽고**(RLS가 범위를 거름)
  service_role로 쓴다. 광역 fan-out(공지·칼럼 수신자)은 service_role로 센다.
- **증적 테이블은 insert/update/delete 정책을 두지 않는다**(= service_role 전용):
  `consent_records`, `admin_access_logs`. 쓰는 주체가 못 고쳐야 증적이다.
- **쓰기 권한은 컬럼 단위로 좁힌다.** 예: `profiles`는 본인이
  `full_name·phone·school·grade`만 쓰고, role·status·동의시각 등은 service_role만.
  정책 `with_check`에서 같은 테이블을 재조회하면 **무한재귀로 기능이 죽는다** —
  컬럼 GRANT로 처리한다.
- **점수·상태처럼 계산으로 정해지는 값은 학생이 못 쓰게 한다.** 시험 제출은
  `submit_attempt()` SECURITY DEFINER만. 답변 노출은 `published_at` 게이트(초안은
  본인에게도 안 보임).
- 대상 지정 어휘: `audience`(all/student/parent) 광역, `targeted`+assignment 핀포인트,
  그룹(`student_groups`)은 동적 멤버십. 자료=동적, 시험 배정=스냅샷(대비 기억).
- 신규 기능/API는 **벌크 우선**(배열·다중 업로드 기본).
- 저장되는 HTML(지문·문항·칼럼)은 **저장 시점에 `sanitizeRichHtml`**. 에디터·CSV
  두 경로가 다 지나게 한 곳에서.
- 클라가 보낸 경로·날짜·id는 믿지 않는다. Storage 경로는 `{본인uid}/...`로 검증,
  입력 마감은 서버 재계산 + RLS `with check` 2중(KST 기준).
- Storage 버킷은 크기·MIME 제한을 건다. 사진 첨부는 planner-proofs 패턴 재사용.

## 4. 알림 · 개인정보

- 알림 fan-out: 발행/배정 시 `notifications`에 user_id별 insert. `created_at`이 미래면
  예약(종에 안 뜸). **재발행 시 중복 알림 주의** — 최초 발행에만 보낸다.
- 알림 제목에 실명을 넣으면 탈퇴해도 남는다(수신자 소유 행). 넣었으면 탈퇴 파기 대상.
- 탈퇴는 **삭제가 아니라 마스킹**(`withdrawAction`). PII·자유서술·인증사진·동의이력·
  Q&A는 파기, 정량 이력은 익명 보존. 처리방침 §6과 동작을 맞춰 한쪽만 고치지 말 것.
- 개인정보 동의·사업자 정보 문구는 **`packages/types/src/consent.ts` 한 곳**에서
  렌더(가입 화면·처리방침·푸터 공유). 문구 고치면 `CONSENT_DOC_VERSIONS`와
  시행일을 반드시 올린다.
- 원장이 개인정보에 닿는 행위(회원 열람·CSV 반출·임시비번 발급·승인/반려)는
  `admin_access_logs`에 남긴다(고시: 1년 보관·월 1회 점검, `/access-logs` 화면).

## 5. UI 규칙

- 같이 놓이는 버튼은 size 통일. **취소가 ghost로 묻히면 안 된다**(outline 등).
- 저장된 HTML 렌더는 `prose prose-sm dark:prose-invert`(Tailwind Typography).
- 폰트는 self-host(`next/font/local`) — 외부 CDN 요청 금지(국외이전 고지 회피).

## 6. 검증 습관

- RLS를 바꾸면 **실제 학생 권한으로 psql 공격 시나리오**를 돌려 확인한다
  (`set local role authenticated` + `request.jwt.claims`, 전부 ROLLBACK).
  남의 데이터 조회·위조 insert·권한 승격·발행 게이트 우회를 직접 시도한다.
- 검증에 쓴 시드/세션 토큰은 지운다.

## 7. 현재 상태 (2026-08-27)

미완·주의로 코드에 TODO를 남긴 것:
- **Turnstile 캡차**: 코드는 붙었으나 키 미설정으로 **꺼짐**. 켜려면 Cloudflare 키 →
  Vercel env → **Supabase 대시보드 Auth CAPTCHA**(이걸 켜야 anon key 직접 호출까지 막힘).
- **Q&A AI 답변 초안**: 어댑터(`apps/admin/src/lib/qna-ai.ts`)만 있고 미구현.
  어드민 답변 화면에 "준비 중" 배지 표시. 승인(발행) 전엔 학생에게 안 나감.
- 외부 공격면·법적 점검 결과는 `docs/` 참조(security-review-*, legal-readiness-*).
