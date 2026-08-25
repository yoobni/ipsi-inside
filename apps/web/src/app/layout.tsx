import type { Metadata } from "next";
import { Black_Han_Sans, Gamja_Flower, Nanum_Pen_Script } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

/**
 * 본문 폰트 — 저장소에 넣고 self-host 한다.
 *
 * 예전엔 <link>로 jsdelivr CDN에서 받았다. 그러면 방문자 브라우저가 그 CDN에
 * 직접 붙어 IP가 국외 제3자에게 전달되는데, 처리방침 §4(위탁)·§5(국외 이전)
 * 목록엔 Supabase·Vercel만 적혀 있었다. 고지를 늘리는 것보다 요청을 없애는
 * 쪽이 간단하다.
 *
 * next/font/google로 부르는 아래 장식용 폰트들은 빌드 타임에 받아 함께
 * self-host되므로(런타임 요청 없음) 같은 문제가 없다.
 *
 * weight 범위는 원본 pretendardvariable.css의 `font-weight: 45 920`과 맞춘다.
 */
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

const blackHanSans = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-black-han-sans",
  display: "swap",
});

const gamjaFlower = Gamja_Flower({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-gamja-flower",
  display: "swap",
});

const nanumPen = Nanum_Pen_Script({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-nanum-pen-script",
  display: "swap",
});

/**
 * 루트 메타데이터.
 *
 * 폐쇄몰이라 색인 대상은 홍보 페이지(/)와 약관/개인정보처리방침뿐이다.
 * 로그인 뒤 화면은 각 세그먼트 layout에서 robots noindex로 덮는다
 * (metadata의 중첩 필드는 마지막에 정의한 세그먼트가 통째로 덮어쓴다).
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "수능 국어",
    "국어 학원",
    "국어 인강",
    "주간 플래너",
    "학습 일지",
    "수능 국어 문제풀이",
    "입시인사이드",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    url: "/",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // 전화번호/주소 자동 링크가 다크 테마에서 파란 밑줄로 튄다
  formatDetection: { telephone: false, address: false, email: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${pretendard.variable} ${blackHanSans.variable} ${gamjaFlower.variable} ${nanumPen.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
