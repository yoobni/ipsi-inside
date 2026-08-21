import type { MetadataRoute } from "next";

/** 어드민 콘솔 — 크롤링 전면 차단. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
