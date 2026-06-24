import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

export const dynamic = "force-static";

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
          <p className="text-muted-foreground text-xs">시행일: 2026년 6월 24일</p>
        </header>

        <p className="text-muted-foreground">
          <strong>HYCO</strong>(이하 "회사")는{" "}
          <strong>입시인사이드</strong>(이하 "서비스") 이용자의 개인정보를
          중요시하며, 「개인정보 보호법」 등 관련 법령을 준수하기 위해 다음과
          같이 개인정보처리방침을 수립·공개합니다.
        </p>

        <Section title="1. 수집하는 개인정보 항목">
          <p className="font-semibold">필수 항목</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>학생: 이름, 휴대폰 번호, 이메일, 학교명, 학년, 비밀번호</li>
            <li>
              학부모: 이름, 휴대폰 번호, 이메일, 비밀번호, 자녀의 이름·휴대폰 번호
              (자녀 매칭용)
            </li>
            <li>
              서비스 이용 기록: 학습 일지, 시험 응시 기록, 출결, 자료 다운로드
              이력
            </li>
          </ul>
          <p className="mt-3 font-semibold">선택 항목</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>마케팅 정보 수신 동의 여부</li>
          </ul>
        </Section>

        <Section title="2. 개인정보 수집 방법">
          회원가입 시 입력, 서비스 이용 과정에서의 자동 수집(접속 IP, 쿠키, 이용
          기록).
        </Section>

        <Section title="3. 개인정보의 이용 목적">
          <ul className="list-disc space-y-1 pl-5">
            <li>가입 승인 및 회원 식별, 본인 확인</li>
            <li>학습 데이터·시험 결과·출결 등 학원 관리</li>
            <li>학생/학부모 리포트 생성 및 제공</li>
            <li>공지사항, 자료 배부, 알림 등 서비스 운영</li>
            <li>(동의 시) 학원 이벤트·신규 강의 등 마케팅 정보 안내</li>
          </ul>
        </Section>

        <Section title="4. 개인정보의 보유 및 이용 기간">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              회원 탈퇴 시 또는 수집·이용 목적 달성 시 지체 없이 파기합니다.
            </li>
            <li>
              관계 법령에 따라 보존해야 하는 정보(전자상거래법 등)는 해당 기간
              동안 별도 보관합니다.
            </li>
            <li>
              학습 일지·시험 응시 기록은 회원의 학습 이력 보존을 위해 회원 탈퇴
              시 모두 삭제합니다.
            </li>
          </ol>
        </Section>

        <Section title="5. 개인정보 제3자 제공">
          회사는 회원의 별도 동의 없이 제3자에게 개인정보를 제공하지 않습니다.
          단, 법령에 따른 수사기관의 요구가 있는 경우는 예외로 합니다.
        </Section>

        <Section title="6. 개인정보 처리 위탁">
          서비스 제공을 위해 다음 업체에 일부 업무를 위탁하고 있습니다.
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Supabase Inc.</strong> — 데이터베이스·인증·스토리지 호스팅
              (서울 리전)
            </li>
            <li>
              <strong>Vercel Inc.</strong> — 웹사이트 호스팅 및 배포
            </li>
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            위탁 업체는 개인정보 보호를 위한 계약상 의무를 부담합니다.
          </p>
        </Section>

        <Section title="7. 정보주체의 권리·의무 및 행사 방법">
          회원은 언제든지 다음의 권리를 행사할 수 있습니다.
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>개인정보 열람·정정·삭제·처리정지 요청</li>
            <li>마케팅 정보 수신 동의 철회</li>
            <li>회원 탈퇴</li>
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            서비스 내 [내 정보] 메뉴 또는 아래 연락처로 요청 가능합니다.
          </p>
        </Section>

        <Section title="8. 개인정보의 안전성 확보 조치">
          <ul className="list-disc space-y-1 pl-5">
            <li>전송 구간 SSL/TLS 암호화</li>
            <li>
              데이터베이스 Row-Level Security(RLS)로 본인·승인된 관리자만 접근
              가능하도록 통제
            </li>
            <li>비밀번호는 해시되어 저장</li>
            <li>접근 권한 최소화 및 정기적 권한 점검</li>
          </ul>
        </Section>

        <Section title="9. 쿠키의 사용">
          서비스는 로그인 세션 유지를 위해 필수 쿠키를 사용합니다. 회원은
          브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 서비스
          이용에 제한이 있을 수 있습니다.
        </Section>

        <Section title="10. 개인정보 보호 책임자">
          <ul className="list-disc space-y-1 pl-5">
            <li>책임자: 고유빈 (대표자)</li>
            <li>연락처: 070-8080-2607</li>
            <li>
              이메일:{" "}
              <span className="text-muted-foreground italic">
                (등록 예정 — 별도 공지)
              </span>
            </li>
          </ul>
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
            <li>상호: HYCO</li>
            <li>대표자: 고유빈</li>
            <li>사업자등록번호: 760-24-01825</li>
            <li>
              주소: (22006) 인천광역시 연수구 센트럴로 313, C동 **층 **호 11-2
              (송도동, 송도씨워크인테라스한라)
            </li>
            <li>연락처: 070-8080-2607</li>
          </ul>
        </Section>

        <footer className="text-muted-foreground border-hairline border-t pt-6 text-xs">
          부칙 — 본 방침은 2026년 6월 24일부터 시행합니다. 변경 시 시행일 7일
          전(회원에게 불리한 변경은 30일 전)에 공지합니다.
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
