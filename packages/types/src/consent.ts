/**
 * 개인정보 수집·이용 동의 — 동의 화면과 처리방침이 같은 데이터를 쓴다.
 *
 * 개인정보보호법 제15조 제2항은 동의를 받는 **그 시점에** 네 가지를 알리도록
 * 요구한다: ① 수집·이용 목적 ② 수집 항목 ③ 보유·이용 기간 ④ 동의를 거부할
 * 권리와 거부 시 불이익. /privacy 링크만 걸어두면 이 넷이 동의 화면에 노출되지
 * 않아서 동의를 받은 것으로 보기 어렵다.
 *
 * 표를 동의 화면과 처리방침에 각각 적으면 반드시 갈라진다 — 자료 배부에서
 * audience 규칙을 스토리지 정책과 RLS 두 곳에 둔 게 버그가 됐던 것과 같은
 * 실수다. 여기 한 곳만 고치면 두 화면이 같이 바뀐다.
 */

export type ConsentKind =
  | "terms" // 이용약관 (필수)
  | "privacy" // 개인정보 수집·이용 (필수)
  | "age14" // 만 14세 이상 확인 (필수)
  | "child_info" // 자녀 개인정보 제공 — 학부모 전용 (필수)
  | "marketing"; // 광고성 정보 수신 (선택)

export const REQUIRED_CONSENT_KINDS = [
  "terms",
  "privacy",
  "age14",
] as const satisfies readonly ConsentKind[];

/**
 * 동의받은 문서의 버전. 문서를 고치면 **반드시** 올린다.
 *
 * 이 값이 없으면 약관을 한 번 고친 뒤로 "이 회원이 무엇에 동의했는지"를
 * 증명할 수 없다. 동의 시각만 저장하던 게 기존 구현의 가장 큰 결함이었다.
 */
export const CONSENT_DOC_VERSIONS = {
  // 2026-08-25: 사업자 주소를 상세 주소까지 표기(제12조)
  terms: "2026-08-25",
  // 2026-08-25: 보호책임자 이메일 기재, 사업자 주소 상세화, 안전성 확보
  //             조치에 접속기록 보관·점검과 인증 시도 제한 추가
  privacy: "2026-08-25",
  age14: "2026-08-21",
  child_info: "2026-08-21",
  marketing: "2026-08-21",
} as const satisfies Record<ConsentKind, string>;

/** 처리방침 시행일 — /privacy 머리말과 변경 이력이 같이 쓴다. */
export const PRIVACY_EFFECTIVE_DATE = "2026년 8월 25일";
export const PRIVACY_PREVIOUS_EFFECTIVE_DATE = "2026년 8월 21일";

/** 이용약관 시행일 — /terms 머리말과 부칙이 같이 쓴다. */
export const TERMS_EFFECTIVE_DATE = "2026년 8월 25일";

/** 수집·이용 동의 표의 한 줄 — 법 제15조 제2항 ①②③에 대응한다. */
export type CollectionRow = {
  /** ① 수집·이용 목적 */
  purpose: string;
  /** ② 수집 항목 */
  items: string;
  /** ③ 보유·이용 기간 */
  retention: string;
};

const ACCOUNT_ROWS: CollectionRow[] = [
  {
    purpose: "회원 식별, 가입 승인, 로그인 및 비밀번호 재설정",
    items: "이름, 휴대폰 번호, 이메일, 비밀번호",
    retention: "회원 탈퇴 시까지",
  },
];

const STUDENT_ROWS: CollectionRow[] = [
  {
    purpose: "반 배정, 주간 플래너 배정, 시험 난이도 결정 등 학원 학습 관리",
    items: "학교명, 학년",
    retention: "회원 탈퇴 시까지",
  },
  {
    purpose: "학습 기록 생성·제공 및 연결된 학부모의 열람",
    items:
      "학습 일지, 플래너 이행 기록 및 인증 사진, 시험 응시·채점 결과, 출결, 자료 열람 이력",
    retention: "회원 탈퇴 시까지 (탈퇴 후 통계는 개인 식별 정보를 제거하여 보관)",
  },
];

const PARENT_ROWS: CollectionRow[] = [
  {
    purpose: "자녀 계정과의 연결 및 열람 권한 부여",
    items: "자녀의 이름, 자녀의 휴대폰 번호",
    retention: "회원 탈퇴 시까지",
  },
];

const AUTO_ROWS: CollectionRow[] = [
  {
    purpose: "로그인 세션 유지, 부정 이용 방지, 동의 사실의 증적 보관",
    items: "접속 IP, 접속 일시, 브라우저·기기 정보, 필수 쿠키",
    retention: "회원 탈퇴 시까지",
  },
];

/** 선택 동의 — 미동의해도 서비스 이용에 제한이 없다. */
export const MARKETING_ROWS: CollectionRow[] = [
  {
    purpose: "학원 이벤트·신규 강의 등 광고성 정보 안내",
    items: "이름, 휴대폰 번호, 이메일",
    retention: "수신 동의 철회 시까지",
  },
];

/**
 * 광고성 정보 전송 수단 — 정보통신망법 제50조에 따라 동의 시점에 밝힌다.
 *
 * ⚠️ 광고성 정보를 **실제로 보내기 전에** 반드시 처리할 것 (2026-08-25 기준 미구현).
 *
 * 지금은 동의만 받아두고 발송 수단이 없다(인앱 알림만 존재). 동의를 받아둔
 * 상태에서 아무 준비 없이 첫 문자를 보내면 아래가 전부 위반이 된다.
 * 정보통신망법 제50조·시행령 제62조의3:
 *
 *   1. 제목 맨 앞에 **(광고)** 표기. 본문에 전송자 명칭과 연락처.
 *   2. 본문에 **수신거부·수신동의 철회 방법**을 명시하고, 그 수단이 실제로
 *      동작해야 한다. (setMarketingConsentAction이 이미 있으니 링크로 연결)
 *   3. 오후 9시~오전 8시 전송은 **별도의 야간 수신 동의**가 필요하다.
 *      지금 받는 동의로는 야간에 못 보낸다.
 *   4. 동의를 받은 날부터 **2년마다** 수신동의 여부를 다시 확인해야 한다.
 *      consent_records의 최신 marketing 행 agreed_at을 기준으로 재확인 발송이
 *      필요하다 — 이 로직이 아직 없다.
 *   5. 수신거부 처리 결과를 14일 이내에 알려야 한다.
 *
 * 발송 채널(SMS 사업자 등)을 붙이면 처리방침 §4 위탁·§5 국외이전 목록에도
 * 추가해야 한다.
 */
export const MARKETING_CHANNELS = "문자(SMS), 이메일";

export function requiredCollectionRows(
  role: "student" | "parent",
): CollectionRow[] {
  return [
    ...ACCOUNT_ROWS,
    ...(role === "student" ? STUDENT_ROWS : PARENT_ROWS),
    ...AUTO_ROWS,
  ];
}

/** 처리방침 §1에서 두 역할을 한 표로 보여줄 때 쓴다. */
export const ALL_COLLECTION_ROWS: CollectionRow[] = [
  ...ACCOUNT_ROWS,
  ...STUDENT_ROWS,
  ...PARENT_ROWS,
  ...AUTO_ROWS,
];

/** ④ 동의 거부권 — 필수 항목 미동의 시의 불이익. */
export const REQUIRED_REFUSAL_NOTICE =
  "위 항목은 서비스 제공에 반드시 필요한 최소한의 정보입니다. 동의를 거부할 권리가 있으나, 거부하시면 회원 가입이 불가능합니다.";

/** ④ 동의 거부권 — 선택 항목 미동의 시의 불이익(없음). */
export const OPTIONAL_REFUSAL_NOTICE =
  "동의를 거부할 수 있으며, 거부하셔도 회원 가입과 서비스 이용에 제한이 없습니다.";

/**
 * 사업자 정보 — 전자상거래법 제10조는 사이버몰 운영자의 상호·대표자·
 * 사업자등록번호·주소·연락처를 **초기화면에** 표시하도록 한다.
 *
 * 약관 제12조, 처리방침 §12, 첫 화면 푸터가 모두 여기를 읽는다. 세 곳에
 * 각각 적으면 주소 하나 바뀔 때 반드시 한 곳이 남는다 — 수집 항목 표를
 * 이 파일로 모은 것과 같은 이유다.
 */
export const BUSINESS_INFO = {
  name: "HYCO",
  representative: "고유빈",
  registrationNumber: "760-24-01825",
  postalCode: "22006",
  address:
    "인천광역시 연수구 센트럴로 313, C동 11-2 (송도동, 송도씨워크인테라스한라)",
  phone: "070-8080-2607",
} as const;

/**
 * 개인정보 보호책임자 — 처리방침 필수 기재사항(성명, 전화, 이메일).
 * 이메일은 선택 항목이 아니다(법 제30조·시행령 제31조).
 */
export const PRIVACY_OFFICER = {
  name: "고유빈 (대표자)",
  phone: BUSINESS_INFO.phone,
  email: "ravi@hyco.dev" as string | null,
};
