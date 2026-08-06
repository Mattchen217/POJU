/** Locale from URL prefix (`/zh/...`) for client-side stream requests. */
export function resolveClientLocale(fallback = "en"): string {
  if (typeof window === "undefined") return fallback;
  const m = window.location.pathname.match(/^\/(en|zh|es|fr)(\/|$)/);
  return m?.[1] ?? fallback;
}
