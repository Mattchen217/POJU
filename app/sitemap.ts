import type { MetadataRoute } from "next";

/** Minimal public sitemap so robots.txt sitemap URL resolves. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.easternos.com";
  const now = new Date();

  const paths = [
    "",
    "/terms",
    "/privacy",
    "/refund",
    "/cookies",
    "/disclaimer",
    "/contact",
    "/poju",
    "/glyph",
    "/syncro",
    "/match",
  ];

  return paths.map((path) => ({
    url: `${site}${path || "/"}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
