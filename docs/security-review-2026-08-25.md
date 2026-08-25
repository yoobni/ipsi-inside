# 보안 전수조사 (2026-08-25)

범위: 인증·인가, RLS 정책 전수, service_role 사용처, XSS/오픈 리다이렉트,
Storage, 시크릿 노출, 업로드 검증, 의존성, 보안 헤더.
방법: 코드 정적 검사 + **실제 학생 권한으로 DB에 공격 시도**(전부 ROLLBACK).

> ## ✅ 2026-08-25 전건 수정 완료
> 마이그레이션 `20260825010000_harden_rls.sql` 적용. 수정 후 **같은 공격을 다시 실행해
> 막힌 것을 확인**했다 — 점수 조작은 `UPDATE 0`, 프로필의 role·status·
> must_change_password·동의시각은 `permission denied`, 정상 기능(이름 수정, 제출 채점 2/2)은
> 그대로 동작. 오픈 리다이렉트 4개 패턴 차단, 보안 헤더 6종 실제 응답 확인,
> sanitizer가 script·onerror·javascript:·iframe·svg를 제거하고 표·이미지는 보존,
> `pnpm audit` 취약점 0건. 양쪽 앱 빌드·lint 통과.
>
> 남은 것은 L-2(가입 시 이메일 열거) 하나이며, **의도적으로 두었다** — 아래 참조.

**총평** — RLS 커버리지는 좋다. `public` 스키마 테이블 **전부 RLS 활성**, 정책 없는 건
`rate_limit_hits` 하나뿐인데 이건 service_role 전용 의도다. 시크릿도 클라이언트 번들로
새지 않고, 업로드는 크기·MIME 검증이 다 있다. 다만 **시험 점수를 학생이 직접 고칠 수 있는
구멍**이 있고, 프로필 수정 정책은 무한 재귀로 기능 자체가 죽어 있다.

---

## ✅ H-1. 학생이 자기 시험 점수를 직접 조작할 수 있다 — 수정됨

**실증** — 학생 권한으로 아래가 성공한다:
```sql
update test_attempts set score=9999, total_points=9999, status='submitted'
 where id='<본인 attempt>';   -- UPDATE 1  ✅ 통과해버림
```

**원인** — `test_attempts_student_rw` 정책이 `for all`이다
(`20260618030000_passages_questions_v2.sql:306`). 본인 assignment인지만 보고 **어떤 컬럼을
쓰든 허용**한다. 점수는 DB가 아니라 제출 서버 액션이 `attempt_total_score` rpc로 계산해
써넣는 값이라, DB 쪽에 이를 지키는 장치가 하나도 없다.

**공격 경로** — 브라우저에 이미 anon key와 본인 JWT가 있다. devtools에서 한 줄이면 된다:
`PATCH /rest/v1/test_attempts?id=eq.<내 attempt>` → `{"score":100,"total_points":100}`.
조작된 점수는 학생 리포트·**학부모 리포트**·단원별 통계에 그대로 반영된다.

같은 이유로 `student_answers_student_rw`도 `for all`이라 **제출이 끝난 뒤에도 답을 고칠 수**
있다. 답을 고치면 `trg_student_answers_grade`가 `is_correct`를 다시 계산한다.

**보수**
- [ ] 제출을 `submit_attempt(p_attempt_id)` **SECURITY DEFINER 함수**로 옮긴다 —
      소유 확인 → 점수 계산 → status/score 기록을 함수 안에서 원자적으로.
- [ ] 학생의 `test_attempts` 정책에서 UPDATE를 뺀다(응시 시작 INSERT와 SELECT만 남긴다).
- [ ] `student_answers` 쓰기 정책에 **`ta.status = 'in_progress'`** 조건을 추가한다.
- [ ] 보강으로 컬럼 권한도 회수:
      `revoke update (score, total_points, status) on test_attempts from authenticated;`

## ✅ H-2. 프로필 수정 정책이 무한 재귀 — 수정됨

**실증** — 학생이 자기 이름을 바꾸는 정상 동작조차 실패한다:
```sql
update profiles set full_name='...' where id=auth.uid();
-- ERROR: infinite recursion detected in policy for relation "profiles"
```

**원인** — `profiles_update_self_basic`의 `with_check`가 role/status를 지키려고
`(select role from profiles where id=auth.uid())`로 **같은 테이블을 다시 조회**한다
(`20260616000000_init_profiles.sql:99`). RLS 평가 중 같은 릴레이션에 재진입해 PostgreSQL이
재귀로 판정한다.

**영향** — 두 방향이다.
- 기능: `/dashboard/profile`의 **본인 정보 수정이 항상 실패**한다(학생·학부모 모두).
- 보안: 그 덕분에 우연히 `must_change_password` 자가 해제와 동의 시각 조작도 막히고 있다.
  재귀만 고치고 끝내면 **그 두 구멍이 열린다** — 반드시 같이 처리해야 한다.

**보수**
- [ ] 서브셀렉트를 이미 있는 SECURITY DEFINER 함수로 교체:
      `role = current_profile_role() and status = current_profile_status()` (재귀 없음)
- [ ] 더 확실하게는 **컬럼 단위 권한**으로 바꾼다. 이러면 정책은 `id = auth.uid()`로 단순해지고
      role·status·must_change_password·동의 시각이 한 번에 보호된다:
      ```sql
      revoke update on public.profiles from authenticated;
      grant update (full_name, phone, school, grade) on public.profiles to authenticated;
      ```
- [ ] 위를 적용하면 `changeMyPasswordAction`의 `must_change_password=false` 쓰기가 막힌다.
      비밀번호 재확인을 이미 통과한 지점이므로 그 한 줄만 service_role로 돌린다.

---

## ✅ M-1. 오픈 리다이렉트 — 수정됨

`new URL(next, url.origin)`은 `next`가 절대 URL이면 origin을 무시한다. 실측:

| next 값 | 결과 |
|---|---|
| `/dashboard` | `https://사이트/dashboard` ✅ |
| `https://evil.example.com/steal` | `https://evil.example.com/steal` ❌ |
| `//evil.example.com` | `https://evil.example.com/` ❌ |

비밀번호 재설정 링크를 매개로 자사 도메인을 거쳐 외부로 보내는 피싱에 쓰인다.
- [ ] `next`는 **`/`로 시작하고 `//`가 아닌 값만** 허용하고, 아니면 `/dashboard`로 떨어뜨린다.

## ✅ M-2. `question-assets` 버킷 제한 없음 — 부분 수정

| 버킷 | public | 크기 제한 | MIME 제한 |
|---|---|---|---|
| `materials` | ✗ | 30MB | application/pdf |
| `planner-proofs` | ✗ | 5MB | jpeg/png/webp |
| **`question-assets`** | **✓ 공개** | **없음** | **없음** |

업로드는 admin만 가능하지만, 버킷 자체 제한이 없어 원장 계정이 털리면 임의 타입 파일을
공개 URL로 호스팅할 수 있다(피싱 페이지·악성 파일 배포). 지문 이미지가 폐쇄형 서비스인데
URL만 알면 비로그인으로 열리는 것도 성격에 어긋난다.
- [ ] 버킷에 `file_size_limit`(5MB)과 `allowed_mime_types`(이미지) 설정 — 코드 검증과 이중화
- [ ] 공개 유지가 꼭 필요한지 재검토. private + signed URL이면 materials와 같은 패턴이 된다

## ✅ M-3. 보안 헤더 — 추가됨

`next.config.ts`에 `headers()` 설정이 없다. 특히 **Supabase 세션 쿠키는 httpOnly가 아니다**
(브라우저 클라이언트도 읽어야 하는 라이브러리 구조). 즉 XSS 한 번이면 세션이 그대로 넘어가므로
CSP의 가치가 보통보다 크다.
- [ ] `Content-Security-Policy`(최소 `frame-ancestors 'none'`, 가능하면 script-src 제한)
- [ ] `X-Frame-Options: DENY` / `X-Content-Type-Options: nosniff` /
      `Referrer-Policy: strict-origin-when-cross-origin` / HSTS

---

## 🟢 낮음 — 기록만

- **L-1 CSV import 경유 저장형 XSS**: 지문 본문은 `dangerouslySetInnerHTML`로 렌더된다
  (응시 화면 포함). 쓰기 권한이 admin뿐이라 실질 위험은 낮지만, **외부에서 받은 CSV를
  일괄 등록**하면 `<script>`가 그대로 들어와 학생 화면에서 실행된다. import 경로에 sanitize 권장.
- **L-2 가입 시 이메일 열거**: `"이미 가입된 이메일입니다"`가 가입 여부를 알려준다.
  (로그인·비밀번호 재설정은 이미 응답이 통일돼 있다.)
- **L-3 dev 의존성 취약점 5건(high)**: 전부 `eslint` 체인(brace-expansion, js-yaml 등).
  런타임 번들에 들어가지 않는다. 정기 업데이트 때 같이 올리면 된다.
- **L-4 `upload-image.ts`의 확장자**: `file.name`에서 잘라 경로에 쓴다. admin 전용이고
  MIME은 화이트리스트로 검증하므로 실익은 없지만, 확장자도 MIME에서 유도하는 게 낫다
  (`upload-proof.ts`가 그렇게 한다).

## ✅ 확인 결과 문제 없던 것

- `public` 스키마 **모든 테이블 RLS 활성**. 정책 0개는 `rate_limit_hits`뿐(service_role 전용 의도).
- guard 없는 서버 액션 19개를 전수 확인 — **전부 사용자 세션 클라이언트**라 RLS가 방어한다.
  service_role을 쓰는 액션은 가입 2개뿐이고, 미인증 호출이 정상인 경로다(rate limit이 방어).
- 학생이 원장에게 임의 알림을 넣는 시도 → **0행**. 학생은 원장 프로필을 읽을 수 없어
  대상 user_id를 구할 수 없다(RLS 이중 방어).
- 시크릿: 클라이언트 번들에 `service_role` 없음. `NEXT_PUBLIC_*`은 공개 가능한 4개뿐.
  `.env*`는 `.gitignore`에 있고 커밋된 적 없음.
- 업로드 3종 모두 크기·MIME 검증 + 인증 확인. 경로는 uuid 기반(ASCII).
- 크론 라우트는 `CRON_SECRET` Bearer 검증, 미설정 시 500으로 닫힘.
- 앱 분리 가드(proxy.ts): admin 세션의 web 접근, 학생 세션의 admin 접근 모두 강제 로그아웃.
- 로그인·비밀번호 재설정은 응답이 통일돼 사용자 열거가 안 된다.

## 수정 내역 (2026-08-25)

| | 한 일 |
|---|---|
| H-1 | 제출을 `submit_attempt()` SECURITY DEFINER 함수로 이관(소유 확인→채점→기록을 원자적으로, 재제출은 멱등). 학생 정책에서 UPDATE 제거, SELECT/INSERT만. `student_answers` 쓰기는 `status='in_progress'`일 때만. 이중 방어로 `score,total_points,status,submitted_at` 컬럼 UPDATE 권한 회수 |
| H-2 | 재귀를 만들던 서브셀렉트를 없애고 정책은 `id = auth.uid()`만. 대신 **컬럼 GRANT**로 `full_name, phone, school, grade`만 쓰게 함 — role·status·must_change_password·동의시각·approved_*가 한 번에 잠긴다. 그에 맞춰 `changeMyPasswordAction`·`setMarketingConsentAction`의 profiles 쓰기를 service_role로 이동 |
| M-1 | `safeNext()` — `/`로 시작하고 `//`·`/\`가 아닌 값만 허용, 나머지는 `/dashboard` |
| M-2 | 버킷에 5MB·이미지 MIME 제한 추가. **public은 유지** — 이 URL이 기존 지문 HTML에 `<img src>`로 박혀 있어 private로 바꾸면 지문 이미지가 전부 깨진다. 바꾸려면 본문 URL 마이그레이션이 함께 필요하다 |
| M-3 | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `CSP(frame-ancestors/object-src/base-uri)`, HSTS를 양쪽 앱에. **script-src는 넣지 않았다** — Next가 RSC 페이로드를 인라인 스크립트로 심어서 nonce 없이 걸면 앱이 죽는다(후속 과제) |
| L-1 | `sanitizeRichHtml()`(sanitize-html) 신설. **저장 시점**에 거르므로 에디터·CSV 두 경로가 모두 덮인다. 지문 본문·발문·〈보기〉·선지 전부 적용 |
| L-3 | eslint 체인 업데이트 + `brace-expansion@1` override → `pnpm audit` 0건 |
| L-4 | 업로드 확장자를 `file.name`이 아니라 검증된 MIME에서 유도 |

**L-2(가입 시 이메일 열거)는 고치지 않았다.** 중복 가입 안내는 가입 폼에서 사실상 필요한
UX이고, 응답을 뭉뚱그리면 "왜 가입이 안 되는지" 모르는 사용자가 생긴다. 열거 자체는
가입 rate limit(IP당 3회/시간)이 실질적으로 막는다 — 시간당 세 개밖에 확인할 수 없다.

## 후속 과제

- [ ] CSP에 `script-src`를 넣으려면 nonce 전파가 필요하다(proxy에서 생성 → 렌더에 주입).
- [ ] `question-assets`를 private로 돌리려면 지문 본문의 이미지 URL 마이그레이션이 선행돼야 한다.
- [ ] 접속기록 월 1회 점검(`/access-logs`)은 운영 습관으로 자리잡아야 의미가 있다.
