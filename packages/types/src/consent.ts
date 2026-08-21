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
  terms: "2026-06-24",
  privacy: "2026-08-21",
  age14: "2026-08-21",
  child_info: "2026-08-21",
  marketing: "2026-08-21",
} as const satisfies Record<ConsentKind, string>;

/** 처리방침 시행일 — /privacy 머리말과 sitemap lastModified가 같이 쓴다. */
export const PRIVACY_EFFECTIVE_DATE = "2026년 8월 21일";
export const PRIVACY_PREVIOUS_EFFECTIVE_DATE = "2026년 6월 24일";

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

/** 광고성 정보 전송 수단 — 정보통신망법 제50조에 따라 동의 시점에 밝힌다. */
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
 * 개인정보 보호책임자 — 처리방침 필수 기재사항(성명, 전화, 이메일).
 *
 * email이 null이면 처리방침에 "등록 예정"으로 표시된다. 운영 시작 전에
 * 반드시 채워야 하는 값이다 — 이메일은 선택 항목이 아니다.
 */
export const PRIVACY_OFFICER = {
  name: "고유빈 (대표자)",
  phone: "070-8080-2607",
  email: null as string | null,
};
