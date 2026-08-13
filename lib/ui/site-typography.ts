/**
 * Site typography SSOT — keep in sync with:
 * - app/layout.tsx (next/font + geist)
 * - styles/ds-tokens/fonts.css
 * - .cursor/rules/10-site-typography.mdc
 *
 * Roles:
 * - UI / body: Geist → Inter → Noto Sans SC
 * - Verse / reflective: EB Garamond
 * - Mono: JetBrains Mono
 * - CJK logo / ritual serif: Noto Serif SC
 */

/** Fallback when CSS variables are unavailable (SSR, email, canvas first paint). */
export const SITE_UI_FONT_FALLBACK =
  'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

/**
 * Resolve the live UI stack for canvas / ECharts (they do not expand CSS `var()`).
 */
export function resolveSiteUiFontFamily(): string {
  if (typeof document === "undefined") return SITE_UI_FONT_FALLBACK;
  const root = getComputedStyle(document.documentElement);
  const parts = [
    root.getPropertyValue("--font-geist-sans").trim(),
    root.getPropertyValue("--font-inter").trim(),
    root.getPropertyValue("--font-noto-sans-sc").trim(),
    "system-ui",
    "sans-serif",
  ].filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join(", ") : SITE_UI_FONT_FALLBACK;
}
