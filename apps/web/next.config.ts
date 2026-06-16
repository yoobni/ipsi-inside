import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 모노레포 루트 명시 — Vercel 빌드 시 워크스페이스 추적 정확성
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // 워크스페이스 패키지 트랜스파일
  transpilePackages: ["@ipsi/lib", "@ipsi/db", "@ipsi/types"],
};

export default nextConfig;
