import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/**
 * 어드민은 전체가 비공개다 — 앱 통째로 색인 금지.
 * robots.ts(크롤 차단)와 여기(색인 차단)를 같이 둔다.
 */
export const metadata: Metadata = {
  title: {
    default: "입시인사이드 어드민",
    template: "%s · 입시인사이드 어드민",
  },
  description: "입시인사이드 — 관리자 콘솔",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
