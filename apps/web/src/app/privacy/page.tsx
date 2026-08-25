import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  ALL_COLLECTION_ROWS,
  BUSINESS_INFO,
  MARKETING_CHANNELS,
  MARKETING_ROWS,
  OPTIONAL_REFUSAL_NOTICE,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_OFFICER,
  PRIVACY_PREVIOUS_EFFECTIVE_DATE,
  REQUIRED_REFUSAL_NOTICE,
  type CollectionRow,
} from "@ipsi/types";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "입시인사이드가 수집하는 개인정보 항목과 이용·보관·파기 절차를 안내합니다.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="bg-background min-h-screen">
      <header className="border-hairline sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur">
        <Wordmark size="md" />
        <Button asChild variant="ghost" size="sm">
          <Link href="/signup">
            <ChevronLeft className="size-4" />
            돌아가기
          </Link>
        </Button>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8 text-sm leading-relaxed">
        <header className="space-y-1">
          <h1 className="font-display text-[28px] leading-tight">
            개인정보처리방침
          </h1>
          <p className="text-muted-foreground text-xs">
            시행일: {PRIVACY_EFFECTIVE_DATE}
          </p>
        </header>

        <p className="text-muted-foreground">
          <strong>HYCO</strong>(이하 &ldquo;회사&rdquo;)는{" "}
          <strong>입시인사이드</strong>(이하 &ldquo;서비스&rdquo;) 이용자의
          개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수하기
          위해 다음과 같이 개인정보처리방침을 수립·공개합니다.
        </p>

        <Section title="1. 수집하는 개인정보 항목, 이용 목적, 보유 기간">
          <p className="font-semibold text-foreground">필수 항목</p>
          <p className="mt-1">
            회원 가입 시 동의를 받아 아래 항목을 수집합니다. 역할(학생·학부모)에
            따라 실제 수집 항목은 달라집니다.
          </p>
          <div className="mt-2">
            <CollectionTable rows={ALL_COLLECTION_ROWS} />
          </div>
          <p className="mt-2 text-xs">{REQUIRED_REFUSAL_NOTICE}</p>

          <p className="mt-5 font-semibold text-foreground">선택 항목</p>
          <div className="mt-2">
            <CollectionTable rows={MARKETING_ROWS} />
          </div>
          <p className="mt-2 text-xs">
            전송 수단: {MARKETING_CHANNELS}. {OPTIONAL_REFUSAL_NOTICE}
          </p>

          <p className="mt-5 font-semibold text-foreground">수집 방법</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>회원 가입 및 서비스 이용 중 이용자가 직접 입력</li>
            <li>학부모 회원이 자녀 연결을 위해 입력한 자녀의 이름·연락처</li>
            <li>서비스 이용 과정에서의 자동 수집(접속 IP, 쿠키, 이용 기록)</li>
          </ul>
        </Section>

        <Section title="2. 만 14세 미만 아동의 개인정보">
          <p>
            서비스는 <strong>만 14세 이상</strong>만 가입할 수 있으며, 가입 시
            만 14세 이상임을 확인받습니다.
          </p>
          <p className="mt-2">
            만 14세 미만 아동의 개인정보를 처리하려면 「개인정보 보호법」 제22조의2에
            따라 법정대리인의 동의를 받고 그 동의 여부를 확인해야 합니다. 회사는
            온라인 가입 절차에서 이를 확인할 수단을 두고 있지 않으므로, 만 14세
            미만 아동의 온라인 회원 가입을 받지 않습니다. 등록이 필요한 경우
            학원으로 문의해주시면 법정대리인의 서면 동의를 받은 후 계정을
            생성합니다.
          </p>
          <p className="mt-2">
            만 14세 미만 아동의 개인정보가 법정대리인의 동의 없이 수집된 사실을
            알게 된 경우, 지체 없이 해당 정보를 파기합니다.
          </p>
        </Section>

        <Section title="3. 개인정보의 제3자 제공">
          <p>
            회사는 이용자의 별도 동의 없이 개인정보를 제3자에게 제공하지
            않습니다. 다만 다음의 경우는 예외로 합니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>연결된 학부모 계정의 열람</strong> — 학생의 학습 일지,
              플래너 이행 기록 및 인증 사진, 시험 응시·채점 결과, 출결은 관리자가
              승인·연결한 법정대리인(학부모) 계정에서 열람할 수 있습니다. 이는
              가입 시 &ldquo;연결된 학부모의 열람&rdquo; 목적으로 동의받은
              범위입니다.
            </li>
            <li>법령에 규정이 있거나 수사기관의 적법한 요구가 있는 경우</li>
          </ul>
        </Section>

        <Section title="4. 개인정보 처리 위탁">
          서비스 제공을 위해 다음 업체에 일부 업무를 위탁하고 있습니다.
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Supabase Inc.</strong> — 데이터베이스·인증·스토리지 호스팅
            </li>
            <li>
              <strong>Vercel Inc.</strong> — 웹사이트 호스팅 및 배포
            </li>
          </ul>
          <p className="mt-2 text-xs">
            위탁 업체는 개인정보 보호를 위한 계약상 의무를 부담하며, 회사는
            위탁 업무의 목적을 벗어난 처리가 이루어지지 않도록 관리·감독합니다.
          </p>
        </Section>

        <Section title="5. 개인정보의 국외 이전">
          <p>
            위탁 업체가 국외에 소재하여 개인정보가 국외로 이전됩니다.
            「개인정보 보호법」 제28조의8 제1항에 따라 아래와 같이 공개합니다.
          </p>
          <div className="mt-2 space-y-3">
            <TransferBlock
              company="Supabase Inc."
              country="미국 (데이터 저장 위치: 대한민국 서울 리전)"
              items="제1항의 모든 필수·선택 항목 및 서비스 이용 기록"
              purpose="데이터베이스·인증·파일 스토리지 운영"
              method="서비스 이용 시점에 네트워크를 통한 전송"
              retention="회원 탈퇴 또는 위탁 계약 종료 시까지"
            />
            <TransferBlock
              company="Vercel Inc."
              country="미국"
              items="접속 IP, 접속 일시, 브라우저·기기 정보, 요청 경로"
              purpose="웹사이트 호스팅 및 장애 대응"
              method="서비스 접속 시점에 네트워크를 통한 전송"
              retention="위탁 계약 종료 시까지"
            />
          </div>
          <p className="mt-3 text-xs">
            이용자는 개인정보의 국외 이전을 거부할 수 있습니다. 다만 위 이전은
            서비스 운영에 필수적이므로, 거부하시는 경우 서비스를 이용할 수
            없습니다.
          </p>
        </Section>

        <Section title="6. 개인정보의 파기 절차 및 방법">
          <p className="font-semibold text-foreground">파기 절차</p>
          <p className="mt-1">
            회원 탈퇴 시 회원을 식별할 수 있는 개인정보를 지체 없이 파기하고,
            개인을 특정할 수 없게 된 학습 이력만 남깁니다. 구체적으로는 다음과
            같이 처리합니다.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              <strong>즉시 파기</strong> — 이름, 휴대폰 번호, 학교, 학년, 동의
              이력, 학습 일지와 그에 달린 피드백, 플래너 지각 사유, 플래너
              인증 사진, 학부모-자녀 연결 정보.
            </li>
            <li>
              <strong>익명 처리 후 보존</strong> — 시험 응시·채점 결과, 출결,
              플래너 이행 여부 등 정량 학습 이력은 위 식별 정보가 제거된 상태로
              남습니다. 통계 및 재등록 시 이력 제공 목적으로만 활용합니다.
            </li>
            <li>
              <strong>계정 식별자</strong> — 동일 이메일의 중복·부정 재가입을
              막기 위해 로그인 계정 자체는 이용 정지 상태로 유지되며, 완전 삭제를
              원하는 경우 제10항의 연락처로 요청할 수 있습니다.
            </li>
          </ol>
          <p className="mt-3 font-semibold text-foreground">파기 방법</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              전자적 파일 형태의 정보는 재생할 수 없는 방법으로 영구 삭제합니다.
            </li>
            <li>
              종이 문서에 기록된 정보는 분쇄하거나 소각합니다.
            </li>
          </ul>
          <p className="mt-3 font-semibold text-foreground">법령상 보존</p>
          <p className="mt-1">
            관계 법령에 따라 보존해야 하는 정보는 해당 법령이 정한 기간 동안
            다른 개인정보와 분리하여 보관한 후 파기합니다.
          </p>
        </Section>

        <Section title="7. 정보주체와 법정대리인의 권리·의무 및 행사 방법">
          이용자와 법정대리인은 언제든지 다음의 권리를 행사할 수 있습니다.
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>개인정보 열람 요구</li>
            <li>오류가 있는 경우 정정 요구</li>
            <li>삭제 요구</li>
            <li>처리정지 요구</li>
            <li>동의 철회 (선택 동의 항목 포함)</li>
            <li>회원 탈퇴</li>
            <li>
              자동화된 결정에 대한 거부 또는 설명 요구 (「개인정보 보호법」
              제37조의2)
            </li>
          </ul>
          <p className="mt-2 text-xs">
            시험 자동 채점은 미리 등록된 정답과 제출 답안을 대조하는 계산이며,
            회사는 이용자의 권리·의무에 중대한 영향을 미치는 결정을 자동화된
            방식으로만 하지 않습니다. 채점 기준에 대한 설명이 필요하면 아래
            연락처로 요구할 수 있습니다.
          </p>
          <p className="mt-2 text-xs">
            권리 행사는 서비스 내 [내 정보] 메뉴 또는 제10항의 연락처를 통해
            가능하며, 법정대리인이나 위임을 받은 자가 대리할 수 있습니다. 회사는
            요구를 받은 날부터 10일 이내에 처리 결과를 알립니다.
          </p>
        </Section>

        <Section title="8. 개인정보의 안전성 확보 조치">
          <ul className="list-disc space-y-1 pl-5">
            <li>전송 구간 SSL/TLS 암호화</li>
            <li>
              데이터베이스 Row-Level Security(RLS)로 본인·연결된 법정대리인·승인된
              관리자만 접근 가능하도록 통제
            </li>
            <li>비밀번호는 해시되어 저장</li>
            <li>파일 스토리지는 만료 시간이 있는 서명 URL로만 접근 허용</li>
            <li>접근 권한 최소화 및 정기적 권한 점검</li>
            <li>
              관리자가 회원 정보를 열람·반출한 기록을 보관하고 정기적으로
              점검
            </li>
            <li>
              로그인 시도 횟수를 제한하여 비밀번호 무차별 대입 시도를 차단
            </li>
          </ul>
        </Section>

        <Section title="9. 자동 수집 장치(쿠키)의 설치·운영 및 거부">
          서비스는 로그인 세션 유지를 위해 필수 쿠키를 사용하며, 광고나 행태
          정보 분석을 위한 쿠키는 사용하지 않습니다. 이용자는 브라우저 설정을
          통해 쿠키 저장을 거부할 수 있으나, 이 경우 로그인이 유지되지 않아
          서비스 이용에 제한이 있습니다.
        </Section>

        <Section title="10. 개인정보 보호책임자 및 열람청구 접수 부서">
          <p className="font-semibold text-foreground">개인정보 보호책임자</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>책임자: {PRIVACY_OFFICER.name}</li>
            <li>연락처: {PRIVACY_OFFICER.phone}</li>
            <li>
              이메일:{" "}
              {PRIVACY_OFFICER.email ?? (
                <span className="text-muted-foreground italic">
                  (등록 예정 — 별도 공지)
                </span>
              )}
            </li>
          </ul>
          <p className="mt-3 font-semibold text-foreground">
            개인정보 열람청구 접수·처리 부서
          </p>
          <p className="mt-1">
            위 개인정보 보호책임자가 열람청구를 직접 접수·처리합니다. 이용자는
            「개인정보 보호법」 제35조에 따른 열람 요구를 위 연락처로 할 수
            있습니다.
          </p>
        </Section>

        <Section title="11. 권익침해 구제 방법">
          개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에 문의할 수
          있습니다.
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>개인정보분쟁조정위원회 (1833-6972, www.kopico.go.kr)</li>
            <li>개인정보침해신고센터 (118, privacy.kisa.or.kr)</li>
            <li>대검찰청 사이버수사과 (02-3480-3573)</li>
            <li>경찰청 사이버수사국 (182, cyberbureau.police.go.kr)</li>
          </ul>
        </Section>

        <Section title="12. 사업자 정보">
          <ul className="list-disc space-y-1 pl-5">
            <li>상호: {BUSINESS_INFO.name}</li>
            <li>대표자: {BUSINESS_INFO.representative}</li>
            <li>사업자등록번호: {BUSINESS_INFO.registrationNumber}</li>
            <li>
              주소: ({BUSINESS_INFO.postalCode}) {BUSINESS_INFO.address}
            </li>
            <li>연락처: {BUSINESS_INFO.phone}</li>
          </ul>
        </Section>

        <Section title="13. 처리방침의 변경">
          <p>
            본 방침을 변경하는 경우 시행일 7일 전(이용자에게 불리한 변경은 30일
            전)에 서비스 내 공지사항으로 알립니다.
          </p>
          <p className="mt-2 font-semibold text-foreground">변경 이력</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              {PRIVACY_EFFECTIVE_DATE} — 개인정보 보호책임자 이메일 기재.
              사업자 주소를 상세 주소까지 표기. 안전성 확보 조치에 접속기록
              보관·점검과 인증 시도 제한을 추가.
            </li>
            <li>
              {PRIVACY_PREVIOUS_EFFECTIVE_DATE} — 만 14세 미만 아동, 국외 이전,
              파기 절차·방법, 자동화된 결정에 대한 권리, 열람청구 접수 부서 항목
              신설. 수집 항목을 목적·보유기간과 함께 표로 정비.
            </li>
            <li>2026년 6월 24일 — 최초 시행</li>
          </ul>
        </Section>

        <footer className="text-muted-foreground border-hairline border-t pt-6 text-xs">
          부칙 — 본 방침은 {PRIVACY_EFFECTIVE_DATE}부터 시행합니다.
        </footer>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold">{title}</h2>
      <div className="text-muted-foreground">{children}</div>
    </section>
  );
}

/** 동의 화면(consent-checks)과 같은 데이터로 그린다 — @ipsi/types/consent */
function CollectionTable({ rows }: { rows: CollectionRow[] }) {
  return (
    <div className="border-hairline overflow-x-auto rounded-md border">
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead className="border-hairline bg-surface-2 border-b">
          <tr className="[&>th]:text-foreground [&>th]:px-2.5 [&>th]:py-1.5 [&>th]:font-semibold">
            <th>수집·이용 목적</th>
            <th>수집 항목</th>
            <th className="whitespace-nowrap">보유·이용 기간</th>
          </tr>
        </thead>
        <tbody className="divide-hairline divide-y">
          {rows.map((row) => (
            <tr
              key={row.purpose}
              className="[&>td]:px-2.5 [&>td]:py-1.5 [&>td]:align-top"
            >
              <td>{row.purpose}</td>
              <td>{row.items}</td>
              <td>{row.retention}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 국외 이전 고지 — 법 제28조의8 제2항이 요구하는 항목을 한 블록으로 */
function TransferBlock({
  company,
  country,
  items,
  purpose,
  method,
  retention,
}: {
  company: string;
  country: string;
  items: string;
  purpose: string;
  method: string;
  retention: string;
}) {
  return (
    <div className="border-hairline bg-surface rounded-md border p-3 text-xs">
      <p className="text-foreground font-bold">{company}</p>
      <dl className="mt-1.5 space-y-1">
        <Row label="이전되는 국가">{country}</Row>
        <Row label="이전 항목">{items}</Row>
        <Row label="이전 목적">{purpose}</Row>
        <Row label="이전 일시 및 방법">{method}</Row>
        <Row label="보유·이용 기간">{retention}</Row>
      </dl>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-faint w-[100px] shrink-0">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
