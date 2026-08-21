import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * 공개 페이지만. 로그인 뒤 화면은 색인 대상이 아니라 넣지 않는다.
 * lastModified는 배포 시각 — 문서를 실제로 고칠 때마다 갱신하고 싶으면
 * 각 페이지의 시행일을 상수로 빼서 넣는 게 정확하다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "monthly", priority: 1 },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
