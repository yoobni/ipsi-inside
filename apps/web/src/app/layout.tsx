import type { Metadata } from "next";
import { Black_Han_Sans, Gamja_Flower, Nanum_Pen_Script } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

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
      className={`${blackHanSans.variable} ${gamjaFlower.variable} ${nanumPen.variable} h-full`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css"
        />
      </head>
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
