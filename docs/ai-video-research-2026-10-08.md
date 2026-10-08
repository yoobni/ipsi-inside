# AI(2-3·2-4) · 강의 영상(2-7·2-8) 도입 리서치와 결정 항목 (2026-10-08)

> `docs/phase3-design-2026-10-08.md` §0-B·§3·§4·§7의 후속. 설계는 그 문서에 있고, 여기는
> **"무엇을 골라야 코드를 시작할 수 있는가"**에 답한다. 가격·정책은 2026-10 공개 자료 기준이며
> 계약 전 재확인이 필요하다. 법률 자문이 아니다.

---

## A. AI — 학습일지 피드백 초안(2-3) · Q&A 답변 초안(2-4)

### A-1. 우리가 쓰는 방식 (전제)
- **사람이 항상 마지막** — AI는 `ai_draft` 컬럼에만 쓰고, 학생에게 가는 본문은 원장/조교가 저장할 때만 채워진다.
  Q&A는 이미 `published_at` 게이트가 있어 구조 변경 없음.
- **보내는 데이터**: 일지 4칸 텍스트·질문 본문(+질문 사진)·최근 피드백 2건(톤 참고). 실명·연락처·학교·id는
  코드에서 제거("학생"으로 치환). 시험 점수는 요약 숫자만.
- 호출량(30명 기준): 일지 초안 **주 1회 → 월 ~130건**, Q&A 초안 **월 ~200건**. 건당 입력 2~3천·출력 ~800 토큰.

### A-2. 제공자 비교

| 제공자 / 모델 | 가격 (입력/출력, 1M토큰) | 우리 월 예상비용* | 데이터 취급 | 한국어 국어 과목 품질 | 비고 |
|---|---|---|---|---|---|
| **Anthropic Claude Sonnet 5** | $2 / $10 | **약 $4~5** | 30일 후 삭제, 학습 미사용(기본) | 상 | 어댑터 스텁이 이미 이 전제. 미국 사업자 → 국외이전 고지 |
| Anthropic Claude Haiku 4.5 | $1 / $5 | 약 $2 | 동일 | 중상 | 비용 절반, 긴 피드백 글의 결은 Sonnet이 낫다 |
| OpenAI GPT-5 mini | $0.25 / $2 | 약 $1 | 30일 후 삭제, 학습 미사용(기본) | 중상 | 미국 사업자 |
| Google Gemini 3.8 Flash | $0.75 / $3.75 (2027-01부터 2배) | 약 $2 → $4 | 유료 API는 학습 미사용 | 중상 | 2027년 인상 예고 |
| **Naver HyperCLOVA X 2.0** | 비공개(원화 결제, 모델별 종량) | 견적 필요 | **국내 사업자 → 국외이전 없음** | 상(한국어 특화) | 처리방침 부담이 가장 작음. 가격은 네이버클라우드 콘솔에서 확인 |
| Upstage Solar Pro 4 | $0.09 / $0.36 | < $1 | 국내 기업이나 서버 위치 확인 필요 | 중상 | 가장 저렴 |

\* 월 330건 × (입력 3천 + 출력 800토큰) 기준. 어떤 선택이든 **비용은 월 1만 원 안팎**이라 결정 요인이 아니다.
결정 요인은 ① 국어 피드백 글 품질, ② 국외이전 고지를 할 것인가, ③ 운영 단순성.

### A-3. 법·개인정보 (개인정보위 「생성형 AI 개발·활용 개인정보 처리 안내서」 2025-08)
- 외부 AI API에 학생 글을 보내는 것 = **처리 위탁**. 해외 사업자면 **국외이전** 항목도 추가.
  → 처리방침 §4(위탁)·§5(국외이전) 개정 + `CONSENT_DOC_VERSIONS` 올림(가입 화면·푸터 자동 반영).
- 보내기 전 식별정보 제거(안내서가 요구하는 가명·최소화)는 코드로 강제한다(위 A-1).
- 학생(미성년)·학부모에게 "AI가 초안을 만들고 선생님이 검수한다"는 **고지 문구**를 어디에 둘지(일지 화면/Q&A 화면) 결정.
- 국내 제공자(HyperCLOVA X)를 고르면 국외이전 고지는 빠지고 위탁 고지만 남는다.

### A-4. 원장이 정해야 하는 것 (AI)
1. **제공자** — 추천: 품질 우선이면 **Claude Sonnet 5**, 고지 부담 최소면 **HyperCLOVA X**(견적 받아 비교).
2. **월 예산 상한** — 제안 ₩30,000. 넘으면 호출 자동 차단(`AI_MONTHLY_BUDGET`), 원장 화면에 사용량 표시.
3. **보낼 데이터 범위** — 일지 텍스트만 / 질문 사진 포함 여부 / 최근 피드백 톤 참고 포함 여부.
4. **처리방침 개정 문구와 고지 위치** — 법률 검토(위탁·국외이전·미성년자 고지). 개정 전엔 켜지 않는다.
5. **피드백 원칙 1장 + 모범 예시 10건**(2-3 프롬프트 재료) — 원장이 써 주는 글 톤이 곧 AI 톤.
6. **2-4 참조 자료 범위** — 교재·해설·강의 스크립트 중 디지털화할 것과 일정(없으면 질문 본문만으로 초안).
7. **적용 순서** — 제안: 어댑터+기록 테이블 → 2-3(검수 탭) → 2-4 단계1(초안) → 단계2(태그 제안). 학생이
   AI와 직접 대화하는 "AI 튜터"(단계3)는 별도 결정.

공수: 어댑터·기록·예산 가드 S(1일) + 2-3 M(2~3일) + 2-4 단계1 S(1일). 제공자 키·처리방침 개정이 선행.

---

## B. 강의 영상 — 자막 검색·타임스탬프(2-7) · 북마크(2-8)

### B-1. 전제
사이트에 영상 기능은 아직 없다. PDF 자료 배부 모델(`audience` all/student/parent/targeted/group)을 그대로
`lectures`에 재사용하고, 재생 토큰은 서버 Route Handler가 짧은 만료로 발급한다(자료 다운로드 서명 URL 패턴).
가정: 강의 100시간(6,000분, 720p 약 60GB), 학생 30명 월 10시간 시청(≈180GB 전송).

### B-2. 플랫폼 비교

| 플랫폼 | 월 비용(가정) | 유출 통제 | 한국어 자막 | 데이터 위치 | 판단 |
|---|---|---|---|---|---|
| **Bunny Stream** | **약 $2~5** (저장 $0.01/GB + 전송 $0.005/GB, 최소 $1) | ◎ 토큰 인증(만료)·referer 제한·다운로드 차단 | Transcribe AI **$0.10/분·언어**(ko 지원) → 100시간 **일회성 $600** | EU(슬로베니아) | **비용 최우선이면 1순위** |
| **Cloudflare Stream** | **약 $50** (저장 $5/1,000분 + 시청 $1/1,000분) | ◎ 서명 URL(만료)·허용 도메인·다운로드 차단 | 생성 자막 **무료**, ko 지원 — 단 한국어 품질 불량 보고 있음(영어 섞임) → **샘플 테스트 필수** | 미국 | 운영 단순·예측 쉬움 |
| Vimeo Core | 약 $33 | ○ 도메인 제한 임베드(2026 개편으로 Core 이상 필요)·비밀번호 | 자동 자막 있음 | 미국 | 플랜 개편·인상 잦음, API 자유도 낮음 |
| YouTube 미등록 | 0 | ✗ 링크 공유·임베드·다운로드 통제 불가 | 자동 자막 | 미국 | **폐쇄형엔 부적합 — 제외 권고** |
| 자체(Supabase Storage) | 과금+트랜스코딩 직접 | △ 서명 URL만, 화질 변환 없음 | 없음 | — | 비권장 |

자막 대안: 플랫폼 STT 대신 **별도 STT**(예: OpenAI Whisper 계열 약 $0.006/분 → 100시간 약 $36, 네이버 CLOVA
Speech 등 국내 STT도 가능)로 VTT를 만들어 업로드하면 어느 플랫폼이든 같은 결과. 어차피 자막은 우리 DB
(`lecture_captions`)에 넣어 검색하므로 **STT 공급자와 영상 플랫폼은 분리해서 골라도 된다.**

유출 방지는 어떤 플랫폼도 **화면 녹화는 못 막는다.** 할 수 있는 것: 로그인 학생만·토큰 5~10분 만료·플레이어
위 실명+시각 워터마크(억지력)·다운로드 차단·동시 재생 제한·시청 로그. 이 중 어디까지 할지가 결정 사항.

### B-3. 법
- **학원법**: 법제처 유권해석 — 등록 학원이 하는 **영상강의도 '교습'에 포함**. 오프라인 등록 학원이 수강생에게
  보조로 VOD를 제공하는 형태는 가능해 보이나, 별도 **원격교습 학원 등록**이 필요한지는 관할 교육지원청에
  확인(원격 학원은 시설 기준 대신 서버·도메인·콘텐츠 계약 서류 요구). `docs/legal-readiness-2026-08-25.md` E-6.
- **개인정보**: 시청자 IP·재생 로그가 플랫폼으로 간다 → 처리방침 위탁·국외이전 추가(Bunny=EU, Cloudflare=미국).
  시청 진도를 우리 DB에 저장하면 수집 항목에도 추가.
- **저작권**: 강의 안에서 쓰는 기출 지문·교재 이미지 — 기존 C-1 지침(출처 기재) 그대로.

### B-4. 원장이 정해야 하는 것 (영상)
1. **플랫폼** — 추천: **Bunny Stream**(월 몇 달러) 또는 **Cloudflare Stream**(월 ~$50, 단순). Vimeo는 비추, YouTube는 제외.
2. **영상 보유량·화질·총 분량**(비용 산출 입력) — 기존 파일 형식, 업로드를 원장이 직접 할지.
3. **자막 확보 방식** — 플랫폼 STT / 별도 STT / 원장 직접(VTT) — 먼저 **샘플 1강 한국어 STT 품질 테스트**를 권한다.
4. **유출 방지 수준** — 토큰 만료 시간, 실명 워터마크 표시 여부, 동시 재생 제한, 시청 로그 보관 기간.
5. **대상 지정** — 전체/그룹/개별 (자료 배부와 같은 모델) + 수강 기간(만료) 둘지.
6. **시청 진도 수집** 여부 — 켜면 2-6 관리 필요 감지·2-5 대시보드에 연결 가능, 대신 개인정보 항목 추가.
7. **교육청 확인·처리방침 개정** — 플랫폼 계약 전에.

공수: L(1~2주) — 업로드/인코딩 플로우, 플레이어+토큰 발급, 자막 적재·검색(`pg_trgm`), 북마크, 진도.
플랫폼·법 확인 후 착수.

---

## C. 한눈에 — 결정 순서 제안
1. AI 제공자 + 예산 → 처리방침 개정(법률 검토) → 피드백 원칙 1장 → **AI 먼저 착수**(공수 작고 효과 큼).
2. 영상은 교육청 확인 + 샘플 STT 테스트 + 플랫폼 결정 → 착수. 둘은 독립이라 병행 가능.

## 출처 (2026-10 조회)
- Anthropic 가격: https://www.cloudzero.com/blog/anthropic-claude-api-pricing/ · https://benchlm.ai/anthropic/api-pricing
- OpenAI 가격: https://www.morphllm.com/openai-api-pricing · https://pricepertoken.com/pricing-page/model/openai-gpt-5-mini
- Gemini 가격(2027 인상): https://www.cloudzero.com/blog/gemini-pricing/ · https://justinmckelvey.com/blog/gemini-api-pricing
- HyperCLOVA X 2.0: https://aiinasia.com/asian-ai/naver-hyperclova-x-2-agent-sdk-korea-asia-launch-2026-05-22 · https://www.llmreference.com/model/hyperclova-x/clova-studio
- Upstage Solar Pro 4: https://openrouter.ai/upstage/solar-pro4
- 데이터 보관·학습 정책: https://www.getvoibe.com/resources/claude-api-data-retention/ · https://openai.com/enterprise-privacy/ · https://witness.ai/blog/ai-data-retention/
- 개인정보위 생성형 AI 안내서: https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=20836 · https://www.kimchang.com/ko/insights/detail.kc?sch_section=4&idx=32696
- Bunny Stream 가격·Transcribe: https://docs.bunny.net/stream/pricing · https://docs.bunny.net/stream/transcribing
- Cloudflare Stream 자막(ko)·품질 이슈: https://developers.cloudflare.com/changelog/2025-01-30-stream-generated-captions-new-languages · https://community.cloudflare.com/t/generated-captions-do-not-work/804335 · 가격 https://developers.cloudflare.com/stream/pricing
- Vimeo 2026 플랜·도메인 제한: https://livid.com/blog/vimeo-price-increase-2026-a-complete-breakdown-of-the-new-plans-and-forced-upgrades/ · https://unil.ink/blog/vimeo-privacy-controls-2026
- 학원법 영상강의 유권해석·원격 학원 등록: https://www.nepla.ai/wiki/교육-문화-언론/평생교육-학원/-법제처-유권해석-... · https://moalive.org/온라인-수업을-하기-위한-원격-학원-설립/ · https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1140&ccfNo=2&cciNo=2&cnpClsNo=1
