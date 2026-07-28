import { routing } from "@/i18n/routing";

const localeSet = new Set<string>(routing.locales);

/** Strips optional locale prefix from pathname (e.g. `/zh/poju` → `/poju`). */
export function getPathnameWithoutLocale(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  if (localeSet.has(segments[0]!)) {
    const rest = segments.slice(1).join("/");
    return rest ? `/${rest}` : "/";
  }
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export function getFirstRouteSegment(pathname: string): string | undefined {
  const path = getPathnameWithoutLocale(pathname);
  const parts = path.split("/").filter(Boolean);
  return parts[0];
}

export function isChatRoute(pathname: string): boolean {
  const path = getPathnameWithoutLocale(pathname);
  return path === "/chat" || path.startsWith("/poju/session/");
}

export function isHomeRoute(pathname: string): boolean {
  return getPathnameWithoutLocale(pathname) === "/";
}

/** Legacy V1 marketing home kept at `/classic` until the tree is deleted. */
export function isClassicLandingRoute(pathname: string): boolean {
  return getPathnameWithoutLocale(pathname) === "/classic";
}

/** Left-sidebar workspace shell (`/app`) — skip marketing chrome. */
export function isWorkspaceAppRoute(pathname: string): boolean {
  const path = getPathnameWithoutLocale(pathname);
  return path === "/app" || path.startsWith("/app/");
}

/** Auth pages bring their own shell — skip marketing chrome. */
export function isAuthRoute(pathname: string): boolean {
  const path = getPathnameWithoutLocale(pathname);
  return (
    path === "/login" ||
    path === "/signup" ||
    path === "/verify" ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path === "/complete-email" ||
    path === "/oauth-popup" ||
    path.startsWith("/login/") ||
    path.startsWith("/signup/") ||
    path.startsWith("/verify/") ||
    path.startsWith("/forgot-password/") ||
    path.startsWith("/reset-password/") ||
    path.startsWith("/complete-email/") ||
    path.startsWith("/oauth-popup/")
  );
}

export type SiteNavActive = "poju" | "glyph" | "syncro" | "match" | "archive";

export function getActiveNavFromPathname(pathname: string): SiteNavActive | null {
  const first = getFirstRouteSegment(pathname);
  if (!first) return null;
  if (first === "poju") return "poju";
  if (first === "syncro") return "syncro";
  if (first === "match") return "match";
  if (first === "archive") return "archive";
  if (first === "glyph" || first === "oracle") return "glyph";
  return null;
}

export type SiteFooterDisclaimerKey = "poju" | "glyph" | "syncro";

export function getFooterDisclaimerKeyFromPathname(pathname: string): SiteFooterDisclaimerKey | null {
  const first = getFirstRouteSegment(pathname);
  if (first === "poju") return "poju";
  if (first === "syncro") return "syncro";
  if (first === "glyph" || first === "oracle") return "glyph";
  return null;
}
