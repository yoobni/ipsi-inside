import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

export const dynamic = "force-static";

export default function TermsPage() {
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
          <h1 className="font-display text-[28px] leading-tight">이용약관</h1>
          <p className="text-muted-foreground text-xs">시행일: 2026년 6월 24일</p>
        </header>

        <Section title="제1조 (목적)">
          이 약관은 <strong>HYCO</strong>(이하 "회사")가 제공하는{" "}
          <strong>입시인사이드</strong>(이하 "서비스")의 이용과 관련하여
          회사와 회원의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
        </Section>

        <Section title="제2조 (정의)">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>서비스:</strong> 회사가 운영하는 폐쇄형 학원 관리 웹사이트
              및 그에 부수하는 학습 관리·리포트·자료 배부 기능
            </li>
            <li>
              <strong>회원:</strong> 회사의 가입 승인을 받아 서비스를 이용하는
              학생, 학부모를 말합니다.
            </li>
            <li>
              <strong>관리자:</strong> 회사가 지정한 운영자(원장)로, 회원 승인
              및 학습 데이터 관리 권한을 가집니다.
            </li>
          </ul>
        </Section>

        <Section title="제3조 (약관의 효력 및 변경)">
          <ol className="list-decimal space-y-1 pl-5">
            <li>본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.</li>
            <li>
              회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며,
              변경 시 시행일 최소 7일 전(회원에게 불리한 변경의 경우 30일 전)에
              공지합니다.
            </li>
            <li>
              변경된 약관에 동의하지 않는 회원은 회원 탈퇴를 요청할 수 있으며,
              공지 후 7일 이내에 거부 의사 없이 서비스를 이용하는 경우 변경 약관에
              동의한 것으로 간주합니다.
            </li>
          </ol>
        </Section>

        <Section title="제4조 (서비스의 제공)">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              회사는 회원에게 다음 기능을 제공합니다: 학습 일지, 시험 응시 및
              자동 채점, 학부모/학생 리포트, 학원 공지·자료 배부, 알림.
            </li>
            <li>
              서비스는 가입 후 관리자 승인을 받은 회원에게만 제공되는 폐쇄형
              서비스입니다.
            </li>
            <li>
              회사는 안정적 서비스 제공을 위해 정기 점검, 시스템 보수 등을
              실시할 수 있으며, 사전에 공지합니다.
            </li>
          </ol>
        </Section>

        <Section title="제5조 (회원가입)">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              회원가입은 본인의 정확한 정보로 신청해야 하며, 타인의 정보를 도용한
              가입은 금지됩니다.
            </li>
            <li>
              만 14세 미만 미성년자는 법정대리인(학부모)의 동의가 필요합니다.
            </li>
            <li>회사는 가입 신청 후 심사를 거쳐 승인 여부를 결정합니다.</li>
          </ol>
        </Section>

        <Section title="제6조 (회원의 의무)">
          <ol className="list-decimal space-y-1 pl-5">
            <li>회원은 가입 시 정확한 정보를 제공해야 합니다.</li>
            <li>
              비밀번호 등 계정 정보는 본인이 관리해야 하며, 타인에게 양도/대여할
              수 없습니다.
            </li>
            <li>
              서비스 내 콘텐츠(지문, 문항, 강의 자료 등)는 회원 본인의 학습
              목적으로만 사용하며, 무단 복제·배포·공유를 금합니다.
            </li>
          </ol>
        </Section>

        <Section title="제7조 (회사의 의무)">
          회사는 안정적 서비스 제공을 위해 노력하며, 회원의 개인정보 보호를 위한
          기술적·관리적 조치를 시행합니다. 자세한 사항은 개인정보처리방침을
          참고하세요.
        </Section>

        <Section title="제8조 (서비스 이용 제한)">
          회사는 다음의 경우 회원의 서비스 이용을 일시 정지하거나 가입을 해지할
          수 있습니다.
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>타인 정보 도용, 허위 정보 기재</li>
            <li>콘텐츠 무단 복제·배포</li>
            <li>서비스 운영을 방해하는 행위</li>
            <li>관계 법령 위반</li>
          </ul>
        </Section>

        <Section title="제9조 (회원 탈퇴)">
          회원은 언제든지 서비스 내 메뉴 또는 운영자에게 요청하여 탈퇴할 수
          있으며, 탈퇴 즉시 개인정보는 개인정보처리방침에 따라 처리됩니다.
        </Section>

        <Section title="제10조 (책임 제한)">
          회사는 천재지변, 통신 장애 등 회사의 귀책이 없는 사유로 인한 서비스
          중단에 대해서는 책임을 지지 않습니다.
        </Section>

        <Section title="제11조 (분쟁 해결)">
          본 약관은 대한민국 법령에 따라 해석되며, 회사와 회원 간 분쟁이 발생할
          경우 회사 소재지 관할 법원을 전속적 합의 관할 법원으로 합니다.
        </Section>

        <Section title="제12조 (사업자 정보)">
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
          부칙 — 본 약관은 2026년 6월 24일부터 시행합니다.
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
