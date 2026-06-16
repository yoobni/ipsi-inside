import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "입시 인사이드 어드민",
  description: "입시 인사이드 — 원장 관리자 콘솔",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
