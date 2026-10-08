# 2차 기능 후보(2-1 ~ 2-11) 설계 보고 (2026-10-08)

원장 요청 "타 사이트를 참고해 추가했으면 하는 기능" 11건에 대한 **설계 보고서**다.
구현은 하지 않았다. 기능마다 ① 지금 사이트에 있는 것, ② 설계, ③ 데이터·권한,
④ **원장이 결정·준비해야 하는 것**, ⑤ 공수를 적었다.

> 전제(2026-10-08 확인):
> - **AI 제공자는 미정.** 제공자 중립 어댑터까지만 설계한다. 어떤 제공자든 붙이는 순간
>   처리방침(§4 위탁·§5 국외이전) 개정이 필요하다 — 임의로 붙이지 않는다.
> - **문항 태그 체계는 원장이 정의**하고 신규 문항부터 태깅한다(기존은 자동 매핑 + 미분류).
> - **강의 영상 플랫폼은 미정.** 비용·외부 노출 관점으로 선택지를 비교해 아래 §7에 담았다.
> - 공수는 S(1~2일)·M(3~5일)·L(1~2주)·XL(2주+)로 적는다. 콘텐츠 제작(원장 몫)은 별도.

---

## 0. 11개 기능이 공유하는 토대 3가지

기능 간 연계를 처음부터 가능하게 하려면, 개별 기능보다 아래 셋을 먼저 세워야 한다.

### 0-A. 문항 태그 체계 (유형 · 작품 · 출처 · 개념) — 2-1, 2-2, 2-9, 2-10, 2-11의 전제

**지금**: `passages.source_type`(독서/문학/화작/언매 4종)만 구조화돼 있고, `unit_major`
(예: 문학-현대시)·`unit_minor`(예: 현대시-김소월)는 자유 텍스트다. 유형·작품·출처·해설
필드는 없다. 즉 "고전소설 64% ⚠️", "세부 유형별 정답률", "이 개념이 출제된 기출"은
지금 데이터로는 만들 수 없다.

**설계**:
| 테이블 | 용도 | 비고 |
|---|---|---|
| `question_types(id, area, label, parent_id, position, archived)` | 유형. 영역(source_type) 아래 2단계 | 원장 정의 |
| `works(id, title, author, genre, era, archived)` | 작품(문학) / 제재(독서) | 가이드(2-9)·허브(2-11)의 단위 |
| `exam_sources(id, year, month, exam, grade, label)` | 기출 출처 (예: 2024 9월 모평 고3) | 저작권 표기와도 연결(legal C-1) |
| `concepts(id, title, parent_id, body_html, archived)` | 개념(초점화, 품사 …) | 2-11 허브의 노드 |
| `passages.work_id`, `passages.source_id` (nullable FK) | 지문 ↔ 작품/출처 | |
| `questions.type_id` (nullable FK), `questions.explanation` (HTML) | 문항 ↔ 유형, 해설 | 해설은 2-1 오답 복습·2-4 AI 참조에 쓰임 |
| `question_concepts(question_id, concept_id)` | 문항 ↔ 개념 N:M | |

- 어드민: `/passages/taxonomy`(원장) — 유형·작품·출처·개념 사전 관리(qna_categories 패턴).
  지문/문항 폼과 CSV 가져오기에 `work`, `source`, `type`, `concepts`, `explanation` 열 추가.
- 기존 문항: `unit_major` 프리셋(독서-인문… 문학-현대시…)은 유형 상위로 **자동 매핑**,
  `unit_minor`는 작품 후보로 목록만 뽑아 원장이 확인. 매핑 안 된 건 '미분류'로 집계에서 분리.
- 집계는 전부 **태그가 있는 문항만** 대상으로 하고 '미분류 N문항'을 같이 보여 준다 — 그래야
  태깅이 덜 된 초기에 숫자가 왜곡되지 않는다.

**원장 결정·준비**: 유형 목록 초안 확정(아래 §부록 A에 제안안), 작품 목록(올해 다룰 작품),
기존 문항의 작품 매핑 검수. **공수 M**(스키마·폼·CSV·사전 UI·자동 매핑).

### 0-B. AI 어댑터 (제공자 중립) — 2-3, 2-4의 전제. **키 연결은 하지 않는다**

**지금**: `apps/admin/src/lib/qna-ai.ts`에 스텁 1개(`ANTHROPIC_API_KEY` 전제, 미구현).
SDK 없음, env 없음, 처리방침에 AI 사업자 없음.

**설계** (`packages/lib/src/ai/`):
- `AiProvider` 인터페이스: `generate({ task, system, messages, maxTokens, images? })` →
  `{ text, usage: {input, output}, model }`. 구현체 `none`(기본, "미연결" 반환)·`anthropic`·
  `openai`를 `AI_PROVIDER` env로 고른다. **기본값 none** — 키가 있어도 env로 켜기 전엔 안 돈다.
- **보내는 데이터 규칙**(코드로 강제): 학생 실명·연락처·id는 절대 안 보냄(이름은 "학생"으로 치환),
  학습 텍스트(일지·질문·시험 결과 요약)만. 이미지는 질문 사진만.
- `ai_generations(id, task, actor_id, target_type, target_id, provider, model, input_tokens,
  output_tokens, est_cost, status, error, created_at)` — 모든 호출 기록. 월 예산 상한(`AI_MONTHLY_BUDGET`)
  넘으면 호출 차단. 원장 화면 `/ai-usage`에 비용·건수.
- **출력은 항상 초안**: DB의 `ai_draft` 컬럼에만 쓰고, 학생에게 가는 컬럼(`body`, `publish_at`)은
  사람이 저장할 때만 채워진다(지금 Q&A 구조 그대로).

**원장 결정·준비**: 제공자(Anthropic/OpenAI/국내), 월 예산, 처리방침 §4·§5 개정(법률 검토),
학부모 고지 여부. **공수 S**(어댑터·기록 테이블·예산 가드). 제공자 결정 전까지 여기서 멈춘다.

### 0-C. 집계·규칙 엔진 재사용 — 2-5, 2-6, 2-2의 전제

이미 있는 `student_stats()`(8주 집계)·`top3_boards()`·`planner_week_stats()`의 지표 정의
(출석 지각 0.5, 과제 (O+△)/도래, 일지 분모=출석일, 시험=시트별 최고 응시)를 그대로 쓴다.
대시보드·감지는 **같은 숫자**를 보여야 학생 리포트와 어긋나지 않는다. 새 RPC는 전부
`staff_can_access_student()`로 조교 범위를 거른다(2026-10-08 리뷰에서 바로잡은 규칙).

---

## 1. 2-1 시험 피드백 및 분석 ★★★★★

**지금**: 학생 결과 화면 = 점수·정답 수·단원별(unit_minor) 정답률 차트·문항별 ✓/✕(문항 본문 없음).
어드민 = 응시별 전체 문항 리뷰, 시트별 문항 정답률(낮은 순). **선지별 분포 없음**(`selected`를
안 읽음), 난이도별·유형별 없음, 추이는 학습 리포트(④)에 시트별 최고 점수 추이만 있음.

**설계**:
- 학생 결과 화면 개편(`/dashboard/tests/[id]/result`):
  1. 총점 + **이전 시험 대비** ▲▼(같은 학생의 직전 시트 최고 점수율과 비교, 학습 리포트 DeltaBadge 재사용)
  2. 영역별(source_type) → **유형별**(type_id) → **난이도별**(상/중/하) 정답률 — 3개 가로 막대
  3. **틀린 문항 복습**: 문항 본문·선지·내 답·정답·**해설**(`questions.explanation`) 아코디언.
     해설 없는 문항은 "해설 준비 중"
  4. 반복 취약 영역·유형: 최근 90일 전체(학습 리포트 `areas`를 유형까지 확장) 중 정답률 최저 2개
  - RPC `attempt_analysis(p_attempt_id)` 하나로 jsonb 반환(SECURITY DEFINER, 본인·학부모·담당 교직원).
    정답·해설은 **제출된 응시에서만** 반환(진행 중 응시엔 안 줌).
- 어드민 **선지별 응답 분석**(`/tests/[id]`): RPC `sheet_choice_distribution(p_sheet_id)` →
  문항별 ①~⑤·미응답 비율 + 정답 표시 + "오답 집중 선지"(정답 외 최다 선지, 비율 ≥ 25%면 강조).
  정렬: 정답률 낮은 순 / 오답 집중도 높은 순. CSV 반출은 원장만(기존 규칙).
- **라이브 OMR (후속 확장, 별도 M)**: `live_sessions(id, sheet_id|question_ids, host_id, join_code,
  status, current_question_id)`, `live_responses(session_id, question_id, student_id, selected, answered_at)`.
  학생은 코드로 입장(`/dashboard/live`), 강사는 문항 넘기며 분포를 Supabase Realtime(Postgres Changes)으로
  실시간 표시. 응답은 성적에 반영하지 않는 수업용 데이터로 분리(원하면 나중에 attempt로 변환).
  Realtime 동시 접속은 Supabase 플랜 한도 확인 필요(Free 200).

**데이터·권한**: 새 컬럼 `questions.explanation`, 0-A 태그. 분포 RPC는 'tests' 권한 + 조교는 담당
학생 응시만 집계(원장은 전체). 결과엔 다른 학생 식별자 없음(비율만).

**원장 결정·준비**: 해설 작성 범위(신규 문항부터? 기출만?), 난이도 입력 습관화(지금 nullable),
라이브 OMR을 1차에 포함할지. **공수 M**(분석 화면·분포) / 라이브 OMR +M.

## 2. 2-2 누적 취약점 분석 → 보충 문제 추천 ★★★★★

**지금**: 학습 리포트에 영역(4종) 90일 정답률만. 유형·작품 단위 없음. 추천 없음.

**설계**:
- RPC `student_mastery(p_student)`: 최근 180일 시트별 최고 응시(+ 2-10 OX 결과)를 유형·작품·개념별로
  묶어 `{tag, total, correct, trend(최근 90 vs 이전 90)}`. 임계: `total ≥ 8`이고 정답률 `< 65%` → ⚠️ 취약.
  (임계값은 설정 테이블 `mastery_settings`에, 원장이 조정.)
- **추천 = 기존 시험 파이프라인 재사용**: "보충 10문제 풀기"를 누르면 서버가 그 태그의 문항 중
  *아직 안 풀었거나 틀린* 문항 N개를 뽑아 **`test_sheets`(kind='practice') + `test_assignments`를 자동 생성**.
  응시·채점·결과 화면·성취도 반영이 전부 기존 코드로 돌아간다(새 채점 코드 0).
  `practice_sets(id, student_id, tag_kind, tag_id, sheet_id, created_by: 'system'|'staff', created_at)`로 추적.
- 선정 규칙: 같은 태그 + 난이도는 학생 정답률에 맞춤(취약이면 '하·중' 위주) + 최근 30일 내 출제 제외.
  문항이 N개 미만이면 "이 유형은 문제가 부족해요(현재 k문항)" — 원장 화면에 **문항 부족 태그 목록**을 보여 줘
  DB를 어디부터 채울지 알게 한다.
- 순환: 보충 세트 결과 → `student_mastery` 다음 계산에 자동 포함 → 취약 해제 시 "극복했어요" 표시.
- 조교·원장도 학생 상세에서 수동으로 세트 만들어 줄 수 있음(ensureStaff + studentIds).

**원장 결정·준비**: 학생이 스스로 시작 vs 원장 승인 후 시작(권장: 스스로, 단 하루 2세트 제한),
세트 크기(기본 10), 태깅된 문항 수가 추천 품질을 결정 → 0-A 선행. **공수 M**.

## 3. 2-3 AI 기반 학습일지 피드백 ★★★★★ — 0-B 결정 전까지 보류

**지금**: 피드백 4칸(종합/나아진 점/못한 점/내일 고칠 것)·초안·발행(`publish_at`)·알림까지 사람 손으로
전부 돌아감. `journal_feedbacks`에 `ai_draft` 없음.

**설계**(구조는 지금 만들어 둘 수 있고, 생성만 제공자 결정 후):
- `journal_feedbacks.ai_draft jsonb`(4칸), `ai_generated_at`, `ai_generation_id` 추가.
- 생성 입력(= Human-in-the-Loop의 "AI가 참고하는 것"): 최근 7일 일지 4칸, 최근 발행 피드백 2건(톤 유지),
  `student_stats` 요약(이번 주 과제·출석·일지 델타), 최근 시험 1건 유형별 결과, 플래너 미이행 항목.
  **이름·연락처 제외.**
- 생성 시점: ① 학생이 일지 제출하면 큐에 넣고 Vercel Cron(5분)이 처리 — 조교가 열면 이미 초안 있음,
  ② 또는 조교가 "초안 생성" 버튼(즉시). ①을 기본으로.
- 검수 흐름: 어드민 일지 목록에 **"AI 초안 대기" 탭** → 4칸이 초안으로 채워진 편집기 → 수정 → 저장(초안) 또는
  발행. 발행만 학생에게 감(지금과 동일). 초안 그대로 발행하면 로그에 `edited:false` 남겨 품질 추적.
- 톤 가이드: 원장이 쓴 "피드백 작성 원칙" 1장 + 과거 피드백 예시 10건을 시스템 프롬프트로.
- 비용 감: 학생 30명 × 일 1건 × 입력 ~3k 토큰 → 제공자별 월 수천 원~1만 원대(제공자 정해지면 산출).

**원장 결정·준비**: 0-B(제공자·예산·처리방침), 피드백 원칙 1장 + 예시 10건, 학부모 고지 문구.
**공수 M**(스키마·큐·검수 탭) — 생성 호출 자체는 어댑터 뒤라 작음.

## 4. 2-4 AI Q&A / 개인 AI 튜터 ★★★★★ — 0-B 결정 전까지 보류

**지금**: Q&A 질문·사진 첨부·답변 초안 → 검수 → 발행 흐름 완성. `qna_answers.ai_draft` 컬럼 있음(미사용).
AI 참조 데이터(교재·해설·스크립트)는 **아직 사이트에 하나도 없다.**

**설계 — 3단계로 나눠 간다**:
- **단계 1 — 검수형 1차 답변** (기존 흐름에 꽂힘): 학생 질문 → 큐 → AI 초안을 `qna_answers.ai_draft`에 →
  조교 검수·수정 → 발행. 참조는 처음엔 **원장이 쓴 과거 Q&A 답변 + 칼럼 + 문항 해설**(사이트 안에 있는 것).
  사진 질문은 vision 지원 제공자일 때만 이미지 전달.
- **단계 2 — 지식 베이스(RAG)**: `kb_documents(id, kind: textbook|explanation|transcript|qa|column|principle,
  title, body, source_ref, visibility)`, `kb_chunks(doc_id, position, content, embedding vector)` — Supabase
  `pgvector`. 수집기: 칼럼·발행된 Q&A 답변·문항 해설은 자동 수집, 교재·강의 스크립트·수업 원칙은 원장 업로드
  (PDF/텍스트 → 청크). 답변에는 **근거 청크 출처**를 붙여 조교가 검증하기 쉽게.
- **단계 3 — 학생 직접 대화 튜터** (`/dashboard/tutor`): 검수 없이 즉답. 가드레일: 근거 없으면 "원장님께
  질문으로 넘길게요"로 Q&A 생성, 답변 저장·샘플 검수(주 N건), 하루 질문 수 제한, 비용 상한.
  **단계 1·2가 돌아가 품질이 확인된 뒤에만** 연다.
- 질문 로그 → 취약점: 질문마다 AI가 유형/작품/개념 태그 제안(0-A 사전에서 고름) → `qna_questions.type_id/concept`
  → `student_mastery`에 "질문 빈도" 축 추가 → 2-2 추천으로 연결.

**데이터·권한·법**: 지식 베이스는 원장 콘텐츠(저작권 OK) 위주. **기출 지문 전문**을 올리면 legal C-1(저작권)
그대로 걸린다 — 기출은 출처·요약만. 학생 질문 텍스트·사진이 제공자로 나감 → 처리방침 §4·§5 + 미성년자 고지.

**원장 결정·준비**: 0-B, 교재·스크립트 디지털화 범위와 일정(가장 큰 입력), 단계 3 개방 기준.
**공수**: 단계 1 S(어댑터 있으면) / 단계 2 L / 단계 3 M.

## 5. 2-5 조교 전용 업무 대시보드 ★★★★☆

**지금**: 조교는 허용된 첫 메뉴로 떨어지고, 각 화면을 돌아다녀야 한다. 일지 목록은 **미작성 학생을
안 보여 주고**(제출된 일지만), Q&A는 개수 집계가 없고, 플래너는 학생·주차 하나씩만 본다.

**설계**:
- 어드민 첫 화면 `/dashboard`(교직원 누구나, `ADMIN_MENU`에 `access:'staff'` 타입 확장 필요) — 카드 목록:
  🔴 오늘 출석했는데 일지 미작성 N명 · 🔴 이번 주 도래 과제 미체크 N명 · 🔴 오늘 마킹 안 한 학생 N명 ·
  🟡 미답변 Q&A N건 · 🟡 AI 초안 검수 대기 N건(2-3 뒤) · 🟡 임시 비밀번호 미변경 N명 · ⚠️ 관리 필요 N명(2-6)
- RPC `staff_dashboard()` SECURITY DEFINER, **호출자 범위(`staff_can_access_student`)·권한으로 거른 집계만**
  반환(학생 id 목록 포함 — 카드 클릭 시 그 학생들만 필터해 보여 주려고; 이름은 각 화면이 RLS로 읽음).
  권한 없는 메뉴 카드는 숨김.
- 카드 → 기존 화면에 **필터 파라미터**로 연결: `/journals?missing=today`, `/planner?unchecked=1`,
  `/daily?unmarked=1`, `/qna?filter=open`, `/members?risk=1`. 일지 화면에 "미작성" 탭 신설(현재 공백).
- 원장도 같은 화면을 홈으로 쓰되 카드가 전체 학생 기준.

**원장 결정·준비**: 카드 종류·순서 확인, 기준 시각(오늘 = KST 06:00 이후?). **공수 M**.

## 6. 2-6 관리 필요 학생 자동 감지 ★★★★☆

**설계**:
- 규칙은 **원장이 조정 가능한 설정 테이블** `risk_rules(key, enabled, threshold, lookback_days)`:

| key | 기본 규칙(제안) | 데이터 |
|---|---|---|
| `journal_streak` | 출석한 날 기준 **3일 연속** 일지 미작성 | daily_attendance + study_journals |
| `homework_streak` | 도래 과제 **연속 5개** 미체크/X | planner_task_checks |
| `test_drop` | 최근 시트 최고 점수율이 직전 3시트 평균보다 **15%p↓** | test_attempts |
| `planner_drop` | 이번 주 수행률이 최근 4주 평균보다 **30%p↓**(도래 ≥ 3) | planner_week_stats 정의 |
| `inactive` | **7일** 동안 일지·플래너 체크·질문·시험 전부 없음 | 4개 테이블 |
| `absent_streak` | **2회 연속** 결석 | daily_attendance |

- RPC `student_risk_flags()` → `[{student_id, flags:[{key, since, detail}]}]`(호출자 범위로 거름).
  매일 KST 06:00 Vercel Cron이 `risk_snapshots(date, student_id, flags)`로 저장(이력·추이용) + 조교
  알림(`notifications` type `risk_detected`, 담당 조교·원장에게).
- 조치 기록: `risk_acknowledgements(student_id, key, acked_by, note, until)` — "상담했음, 2주간 숨김".
  감지 해제는 조건 해소 시 자동.
- 표시: 대시보드 카드, 회원 목록 ⚠️ 배지, 학생 상세 상단 "관리 필요 사유 + 조치 기록".

**원장 결정·준비**: 임계값 6개 확정(위 기본값으로 시작 가능), 알림 받을 사람. **공수 M**.

## 7. 2-7 강의 자막 검색 + 타임스탬프 · 2-8 강의 북마크 ★★★★☆ — 영상 플랫폼 결정 필요

**지금**: 사이트에 **강의 영상 기능이 전혀 없다**(테이블·화면·임베드 없음). 자료 배부는 PDF 전용.
리치 에디터/새니타이저는 `<iframe>`·`<video>`를 지운다(영상은 구조화 필드로 넣어야 함).
`docs/legal-readiness` E-6: VOD 도입 시 위탁·국외이전 목록 추가 + **학원법 인터넷 통신교습 등록 요건 검토**.

### 7-1. 플랫폼 비교 — 비용과 "외부로 새어 나갈 수 있는가"

가정: 강의 100시간(6,000분, 720p 약 60GB) 보관, 학생 30명이 월 10시간씩 시청(18,000분 ≈ 180GB).

| 선택지 | 월 비용(가정 기준) | 외부 노출 통제 | 자막(STT) | 비고 |
|---|---|---|---|---|
| **YouTube 미등록** | 0원 | ✗ 링크를 아는 누구나 재생·공유·임베드 가능, 도메인 제한 불가, 다운로드 방지 불가 | 자동 자막 있음(API로 받기 제한적) | 폐쇄형 학원 콘텐츠엔 **부적합** |
| **Vimeo** Standard~Advanced | 약 $20~65 (연 결제·플랜 개편 잦음) | ○ 비밀번호·도메인 제한 임베드(최근 자료상 도메인 제한은 Advanced 필요 가능성) | 자동 자막 있음 | 2024~26 가격 인상·플랜 강제 전환 이력 |
| **Cloudflare Stream** | 저장 $5/1,000분 + 시청 $1/1,000분 → **약 $30 + $18 = ~$50** | ◎ **서명 URL(토큰, 만료)** + 허용 도메인, 다운로드 차단 | AI 자동 캡션 지원(한국어 지원 여부 확인 필요) | 가격 단순·예측 쉬움 |
| **Bunny Stream** | 저장 $0.01/GB + 전송 $0.005/GB → **약 $0.6 + $0.9 ≈ $2**(최소 $1) | ◎ **토큰 인증 + referer 제한**, 다운로드 차단 | 유료 transcription 애드온(한국어 확인 필요) | 가장 저렴. 슬로베니아 사업자 |
| 자체(Supabase Storage) | 저장·전송 과금 + 트랜스코딩 직접 | △ 서명 URL은 되나 스트리밍·화질 변환 없음 | 없음 | **비권장** |

(출처는 §부록 B. 가격은 2026-10 기준 공개 자료이며 계약 전 재확인 필요.)

**추천**: 비용이 핵심이면 **Bunny Stream**, 운영 단순성·예측 가능성이면 **Cloudflare Stream**. 둘 다
① 토큰/서명 URL로 **로그인한 학생만, 짧은 만료 시간으로** 재생, ② 플레이어 위에 **학생 이름·시각
워터마크**(화면 녹화 억지력 — 완전 방지는 어떤 플랫폼도 불가), ③ 시청 로그는 우리 DB에만.
YouTube는 비용 0이지만 유출 통제가 없어 제외를 권한다.

**법·개인정보**: 영상 자체는 개인정보가 아니지만 **시청자 IP·재생 로그가 플랫폼으로 간다** → 처리방침
§4 위탁·§5 국외이전에 추가. 학원법 통신교습 등록은 **법률 검토 필요**(이 문서는 법률 자문이 아님).

### 7-2. 설계 (플랫폼 무관 부분)

- `lectures(id, title, course, unit_label, work_id?, provider, provider_video_id, duration_sec, audience,
  is_published, published_at)` + `lecture_group_targets`(자료 배부의 audience 모델 재사용)
- `lecture_captions(lecture_id, start_ms, end_ms, text)` + 전문검색: 한국어는 `pg_trgm`(GIN) 기반 부분 일치
  (형태소 분석 없이도 "초점화" 같은 명사 검색은 충분). 자막 입력: 플랫폼 STT 결과(VTT) 또는 원장이 VTT/SRT 업로드.
- `lecture_bookmarks(id, student_id, lecture_id, position_ms, note, created_at)` — 학생 본인 행만(RLS).
- 재생: 플랫폼 플레이어 SDK로 `seek(ms)`. 검색 결과(`18:32 — 초점화의 개념은…`) 클릭 → 해당 시점.
  재생 토큰은 **서버 Route Handler**가 발급(자료 다운로드 서명 URL 패턴 재사용), 만료 5~10분.
- 학생 "내 북마크" 모아보기(`/dashboard/lectures/bookmarks`), 강의별 자막 검색, 전체 강의 자막 검색.
- 시청 진도(`lecture_progress(student_id, lecture_id, last_position_ms, watched_sec)`)를 같이 두면
  2-6 `inactive` 규칙과 2-5 대시보드에도 쓸 수 있다.

**원장 결정·준비**: 플랫폼·예산, 영상 보유량·화질, 자막 확보 방식(STT vs 직접), 법률 검토.
**공수 L**(플랫폼 연동·업로드 플로우·자막 검색·북마크·플레이어) — 플랫폼 결정 후 착수.

## 8. 2-9 작품/지문별 학습 가이드 ★★★★★

**지금**: 자료는 PDF 다운로드, 칼럼은 글 1편. 지문·문항은 **시험에 배정된 학생만** 읽을 수 있다(RLS).
작품 개념 없음(0-A).

**설계**:
- `guides(id, work_id|passage_id, title, summary, status draft|published, published_at)`
- `guide_steps(id, guide_id, position, kind, payload jsonb)` — kind 8종 고정:
  `intro`(핵심 가이드 HTML) · `read`(지문 읽기: passage_id) · `visual`(인물 관계·개념도: 이미지+캡션) ·
  `comic`(핵심 장면 이미지들) · `ox`(2-10 drill_id) · `questions`(태그=작품 문항 → 2-2 보충 세트 생성) ·
  `review`(틀린 것 복습: 직전 두 단계 결과에서 자동 구성) · `summary`(핵심 정리 HTML)
- `guide_progress(student_id, guide_id, step_id, completed_at)` — `column_reads` 패턴(한 단계 완료 = 1행).
- 학생 화면 `/dashboard/guides/[id]`: 단계 네비 + 진행 바, 다음 단계는 이전 완료 후 열림(선택 설정).
- 지문·문항을 시험 밖에서 보여 주려면 새 읽기 경로 필요: RPC `guide_content(guide_id)` SECURITY DEFINER가
  **발행된 가이드의** 지문 본문과 문항(정답 제외)만 반환. 풀이·채점은 2-2 보충 세트(기존 시험 파이프라인).
- 이미지: 새 버킷 `guide-assets`(원장 업로드, 공개 읽기 or 서명 URL) — 만화·개념도.
- 어드민 `/guides`: 단계 편집기(순서 드래그는 후순위, 위/아래 버튼으로 시작), 미리보기, 발행·대상(audience).

**원장 결정·준비**: 시범 작품 3~5개 선정, 각 작품 글·이미지(만화) 제작, 작품별 OX·문항 태깅.
**공수 L**(편집기·학생 플로우·RPC·버킷) + 콘텐츠 제작은 별도.

## 9. 2-10 OX 및 짧은 인터랙티브 훈련 ★★★★☆

**설계**:
- `drills(id, title, kind, work_id?, concept_ids[], item_count, time_limit_sec?, is_published, created_by)`
  kind 1차 3종: `ox`(O/X), `choice`(보기 선택), `classify`(탭해서 분류 — 품사 등). 2차: `drag`(dnd-kit 도입),
  `timed`(제한시간 판단).
- `drill_items(id, drill_id, position, payload jsonb, answer jsonb, explanation)` —
  `ox: {statement}` / `choice: {prompt, options[]}` / `classify: {buckets[], tokens[]}`.
  **정답·해설은 RPC로만**: `drill_items_for_play(drill_id)`는 answer 없이 반환, 채점은
  `submit_drill_answer(item_id, answer)` SECURITY DEFINER(시험의 `submit_attempt` 패턴 — 지금 `questions.correct_answer`가
  컬럼 보호 없이 select되는 것과 같은 실수를 반복하지 않는다).
- `drill_attempts(id, student_id, drill_id, started_at, finished_at, correct, total)`,
  `drill_item_results(attempt_id, item_id, correct, elapsed_ms, retry_no)` — 틀린 항목 즉시 재출제는 클라이언트가
  큐에 다시 넣고 `retry_no`로 기록.
- 학생 화면: 5~10문항, 한 화면에 하나, 즉시 정오 + 해설, 끝나면 요약·"다시 틀린 것만". 가이드(2-9)의 ox 단계와
  작품/개념 허브(2-11)에서 진입. 결과는 `student_mastery`(2-2)의 개념 축에 반영.
- 어드민 `/drills`: 폼 + CSV(`kind, statement, answer, explanation, work, concepts`).

**원장 결정·준비**: 1차 3종으로 충분한지, 작품/개념별 문항 작성. **공수 M**(3종) / drag·timed +S~M.

## 10. 2-11 개념·작품·기출·문제 DB 연결 ★★★★☆

**설계** — 새 데이터보다 **0-A 태그 위의 허브 화면**이다:
- 학생 `/dashboard/library`: 작품 / 개념 / 기출 세 탭.
  - 작품 페이지: 소개(원장 HTML) → 관련 지문(work_id) → 이 작품이 나온 기출(exam_sources) → 관련 문항 수·
    "보충 풀기"(2-2) → OX(2-10) → **내 성취도**(student_mastery의 그 작품/유형) → 학습 가이드 링크(2-9).
  - 개념 페이지: `concepts.body_html` → 관련 작품 → 출제 기출 → 문항·OX → 내 성취도.
  - 기출 페이지: 출처별 지문·문항 목록(저작권: 전문은 시험/가이드 안에서만, 목록엔 제목·유형만).
- 어드민은 `/passages/taxonomy`에서 개념 본문·연결을 편집(0-A와 같은 화면).
- 읽기 권한: 허브 목록은 태그·제목·개수만(공개 읽기 정책), 지문 본문·문항은 2-9의 `guide_content`/2-2 세트로만.

**원장 결정·준비**: 0-A 태깅 진척에 비례해 가치가 생김. **공수 M**.

---

## 11. 의존 관계와 권장 순서 (제안 — 결정은 원장)

```
0-A 태그 체계 ──┬─▶ 2-1 시험 분석(선지 분포) ──▶ 2-2 취약점→추천 ──▶ 2-11 허브
                ├─▶ 2-10 OX 훈련 ──────────────┘          ▲
                └─▶ 2-9 학습 가이드(콘텐츠 제작 병행) ─────┘
0-C 집계 재사용 ──▶ 2-5 대시보드 + 2-6 감지 (독립, 바로 가능)
0-B AI 어댑터(제공자 결정 후) ──▶ 2-3 AI 일지 ──▶ 2-4 단계1 → 2 → 3
영상 플랫폼 결정 + 법률 검토 ──▶ 2-7/2-8 강의 복습
```

| 묶음 | 내용 | 결정 필요 | 공수 |
|---|---|---|---|
| **A. 토대·분석** | 0-A 태그 체계, 2-1 시험 분석(선지 분포), 2-5 대시보드, 2-6 감지 | 유형 목록·임계값 확정 | M+M+M+M |
| **B. 훈련·추천** | 2-10 OX 3종, 2-2 추천(시험 파이프라인 재사용), 2-11 허브 | 세트 크기·자율 시작 여부 | M+M+M |
| **C. 가이드** | 2-9 시범 3작품 | 작품 선정·이미지 제작 | L + 콘텐츠 |
| **D. AI** | 0-B 어댑터 → 2-3 → 2-4 단계1·2 | **제공자·예산·처리방침** | S+M+S+L |
| **E. 영상** | 2-7·2-8 | **플랫폼·법률 검토** | L |

A부터 가는 이유: AI·추천·허브가 전부 "태깅된 문항"과 "같은 지표"를 먹고 살아서, 토대 없이 위를 올리면
다시 뜯게 된다. D·E는 결정 사항이 남아 있어 그 전엔 어댑터·스키마까지만 준비한다.

## 12. 원장이 결정·준비해야 하는 것 (체크리스트)

- [ ] **문항 유형 목록** 확정 (§부록 A 초안 검토) · 올해 다룰 **작품 목록** · 기존 문항 작품 매핑 검수
- [ ] 문항 **해설** 작성 범위 · **난이도** 입력 습관화
- [ ] 관리 필요 **임계값 6개**(§6 기본값으로 시작 가능) · 알림 받을 사람
- [ ] 보충 세트: 학생 자율 시작 허용 여부 · 세트 크기 · 하루 상한
- [ ] **AI 제공자·월 예산** → 처리방침 §4·§5 개정(법률 검토) · 피드백 톤 가이드 1장 + 예시 10건 · 교재/스크립트 디지털화 범위
- [ ] **영상 플랫폼**(권장: Bunny 또는 Cloudflare Stream) · 영상 보유량 · 자막 확보 방식 · 학원법 통신교습 등록 검토
- [ ] 가이드 시범 작품 3~5개와 이미지(만화·개념도) 제작 일정
- [ ] (이미 보류 중) TOP3 실명 모드를 쓰려면 처리방침 '학습 성과 공개' 항목

---

## 부록 A. 문항 유형 초안 (원장 확정용 — 수능 국어 일반 분류 기준, 수정 전제)

- **독서**: 핵심 정보 파악 · 세부 정보 확인 · 전개 방식(글의 구조) · 추론(생략된 정보) · 구체적 사례/〈보기〉 적용 ·
  비판적 이해 · 어휘(문맥적 의미)
- **문학**: 표현상 특징 · 내용(인물·정서) 이해 · 시어/구절의 의미 · 서술상 특징 · 외적 준거(〈보기〉) 감상 ·
  작품 간 비교 · 갈래 특성
- **화법·작문**: 말하기 방식 · 자료 활용 · 고쳐쓰기 · 조건에 맞는 표현 · 대화/토의 전략
- **언어·매체**: 음운 · 품사/단어 형성 · 문장(문장 성분·높임·시제) · 중세 국어 · 매체 특성 · 매체 자료 수용/생산

## 부록 B. 영상 플랫폼 가격·기능 출처 (2026-10 조회)

- Cloudflare Stream 공식 가격: https://developers.cloudflare.com/stream/pricing ($5/1,000분 저장, $1/1,000분 시청)
- Bunny Stream 공식 가격: https://docs.bunny.net/stream/pricing (저장 $0.01/GB, 전송 $0.005/GB, 최소 $1)
- Bunny 1년 사용 후기(토큰 인증·핫링크 보호): https://www.bitdoze.com/bunny-net-review/
- Vimeo 2026 플랜 비교: https://www.unilink.us/blog/vimeo-pricing-plans-2026 · 가격 인상·강제 전환:
  https://livid.com/blog/vimeo-price-increase-2026-a-complete-breakdown-of-the-new-plans-and-forced-upgrades/
- YouTube 미등록/비공개 한계(링크 공유·임베드·다운로드 방지 불가): https://swarmify.com/blog/youtube-unlisted-vs-private/ ·
  https://www.gumlet.com/learn/youtube-unlisted-vs-private-video-hosting/
- 사내 문서: `docs/legal-readiness-2026-08-25.md` E-6(VOD), C-1(기출 저작권·출처 기재)
