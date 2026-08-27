# 외부 공격 표면 점검 (2026-08-26)

관점: 로그인하지 않은 외부인이 인터넷에서 직접 때릴 수 있는 것.
방법: 실제로 요청을 쏴서 확인. anon key는 **공개값**이라 공격자도 갖고 있다는 전제.

**핵심 결론** — 애플리케이션 코드는 잘 막고 있다. RLS로 데이터는 비로그인 0건,
크론은 401, 대용량 본문은 1MB로 잘린다. **남은 공격면은 전부 Supabase 프로젝트
설정 영역**이다 — 공격자가 우리 서버(와 우리가 만든 rate limit)를 건너뛰고
Supabase Auth 엔드포인트를 직접 때릴 수 있기 때문이다. 이건 코드로 못 막고
대시보드에서 켜야 한다.

---

## 🟠 E-1. anon key로 우리 rate limit을 우회한 무차별 대입 — 부분 조치

**실측** — Supabase Auth에 존재하는 계정으로 30회 연속 틀린 비밀번호:
```
POST https://<ref>.supabase.co/auth/v1/token?grant_type=password
→ 400 400 400 ... (30회 전부 통과, 429 없음)
```
우리가 만든 `checkRateLimit`(로그인 5회/10분)은 **서버 액션**에만 걸려 있다.
공격자는 로그인 폼을 안 쓰고 위 엔드포인트를 직접 두드리면 그만이다.
anon key는 브라우저에 내려가는 공개값이라 누구나 갖는다.

**의미** — 앱 레벨 rate limit이 쓸모없다는 게 아니다(정상 사용자·앱 경유 공격·
DB 부하는 여전히 앞단에서 막는다). 다만 **결정적 방어선은 될 수 없다.**

**보수 — Supabase 대시보드에서 (코드 아님)**
- [ ] **Auth → Rate Limits**: password grant의 IP당 시도 한도를 낮춘다(기본이 느슨하다).
- [ ] **Auth → Attack Protection → CAPTCHA 활성화**(hCaptcha 또는 Cloudflare Turnstile).
      이게 근본 방어다. 켜면 `signInWithPassword`에 `captchaToken`이 필수가 되므로
      **로그인·가입 폼에 위젯을 붙이는 코드 작업이 따라온다**(아래 결정 필요 참조).
- [ ] **Leaked Password Protection** 켜기(HaveIBeenPwned 대조) — 유출된 비밀번호 차단.

## 🟠 E-2. public signup으로 auth.users를 오염시킬 수 있다 — 부분 조치

우리 앱은 가입을 **admin API + email_confirm**으로만 만든다. 그런데 Supabase의
public `/auth/v1/signup` 엔드포인트는 anon key로 열려 있어, 우리 가입 폼을 거치지
않고 계정을 만들 수 있다(이번엔 이메일 발송 rate limit에 걸려 실패했지만, 그건
부수적 방어다). 만들어진 계정은 `profiles` row가 없어 앱에선 못 쓰지만
(proxy가 강제 로그아웃), **auth.users 테이블이 쓰레기 계정으로 차오르고
이메일 발송 비용이 나간다.**

**보수 — Supabase 대시보드**
- [ ] 자체 회원가입이 필요 없다면 **Auth → Sign Up 비활성화**(우리는 admin API로만 만든다).
      막아도 기존 가입 폼은 admin API를 쓰므로 영향이 없다. — **가장 깔끔한 해결**
- [ ] 남겨둔다면 E-1의 CAPTCHA가 여기도 방어가 된다.

## 🟡 E-3. GET /api/signout — 강제 로그아웃 CSRF

`<img src="https://사이트/api/signout">` 한 줄을 어딘가 심으면 그걸 여는 로그인
사용자를 로그아웃시킬 수 있다. GET이 상태를 바꾸기 때문이다. 다만 **피해가
로그아웃뿐**이고, 이 경로는 proxy가 잘못된 세션을 자동 정리하는 데 GET으로
의존하고 있어 함부로 POST-only로 못 바꾼다. 위험도 낮음 — 기록만 한다.
- [ ] (선택) 정리용 자동 호출과 사용자 로그아웃 경로를 분리하고 후자만 POST로.

---

## ✅ 확인 결과 잘 막고 있던 것

| 케이스 | 시도 | 결과 |
|---|---|---|
| 비로그인 데이터 탈취 | anon key로 11개 테이블 조회 | **전부 0건** (RLS) |
| 비밀번호 재설정 폭탄 | recover 메일 5회 연속 | 2회째부터 **429** (Supabase 자체) |
| 크론 무단 실행 | 시크릿 없이/틀린 Bearer | **401** |
| 대용량 본문 DoS | web 서버 액션에 10MB | 기본 **1MB** 초과 차단 |
| 서버 액션 CSRF | — | Next가 Origin=Host 대조(same-origin만 허용, 기본값) |
| 보안 헤더 | — | X-Frame-Options·CSP(frame-ancestors)·nosniff 등 6종 응답 |

- admin 앱은 서버 액션 본문 한도가 32MB다(PDF 업로드 30MB 때문). admin은 로그인
  필수라 외부 노출 위험은 낮지만, 업로드 액션에만 큰 한도가 필요하다면 그 경로만
  키우는 게 이상적이다(현재는 앱 전역). 위험도 낮음.

## 조치 내역 (2026-08-26) — CAPTCHA 코드 도입

Cloudflare Turnstile을 붙였다. `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`가
비어 있으면 기능이 통째로 꺼져(위젯 미표시·서버 검증 skip) 지금처럼 동작하고,
키를 채우면 켜진다.

- 위젯: `TurnstileWidget`(web·admin). 로그인·학생가입·학부모가입·비밀번호찾기·
  관리자로그인 다섯 폼에 삽입. implicit 모드라 `cf-turnstile-response` 토큰을
  폼에 자동으로 넣는다.
- 서버: `verifyTurnstile()`가 다섯 액션 진입부에서 토큰을 Cloudflare siteverify로
  확인한다(secret 없으면 skip). Cloudflare 테스트 키로 pass/fail 실제 확인함.
- login·recover·admin-login은 `captchaToken`을 Supabase에도 넘긴다 — 대시보드
  CAPTCHA가 켜지면 Auth 측에서도 검증해 **서버 우회 직접 호출까지** 막힌다.
- signup 2개는 admin API 경로(대시보드 캡차 미적용)라 `verifyTurnstile`이 유일 방어.

### 운영에서 켜려면 (대시보드 — 코드 아님, 아직 안 됨)
- [ ] Cloudflare Turnstile 위젯 발급 → site/secret 키를 Vercel web·admin env에 등록
- [ ] **Supabase 대시보드 Auth → CAPTCHA 활성화 + 같은 secret 등록** — 이게 켜져야
      E-1의 "anon key로 Auth 직접 때리기"가 실제로 막힌다. 우리 서버 검증만으로는
      서버를 우회하는 요청을 못 막는다.
- [ ] (E-2) 자체 회원가입이 불필요하면 **Auth → Sign Up 비활성화**(우리는 admin API로만 생성)
- [ ] (권장) Auth Rate Limit 강화 + Leaked Password Protection

### 남은 판단
- CAPTCHA를 실제로 켤지(키 발급·대시보드)는 운영자 몫. 코드는 준비됐고 env만 채우면 된다.
- 검증은 로직 분기 + siteverify 실제 응답까지 확인했다. **브라우저에서 위젯이 뜨고
  통과되는 end-to-end는 키를 넣은 뒤 직접 봐야 한다.**
