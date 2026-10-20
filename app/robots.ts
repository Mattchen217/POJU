import type { MetadataRoute } from "next";

/**
 * Valid robots.txt for crawlers / Lighthouse SEO.
 * Must not fall through to the marketing HTML shell.
 */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.easternos.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/ops/", "/kv/", "/_next/"],
      },
    ],
    host: site,
    sitemap: `${site}/sitemap.xml`,
  };
}
