import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * 폐쇄몰이라 크롤러에 열어주는 건 홍보 페이지와 약관·개인정보처리방침뿐이다.
 *
 * 각 페이지에도 robots meta를 걸어두지만(중복 방어), robots.txt는 크롤러가
 * 페이지를 요청조차 하지 않게 막는 1차 게이트라 둘 다 필요하다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/pending",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/auth/",
        "/api/",
        "/maintenance",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
