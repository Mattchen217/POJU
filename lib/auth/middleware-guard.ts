import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/auth-helpers";
import { userNeedsEmail } from "@/lib/auth/user-identity";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import {
  getPathnameWithoutLocale,
  isAuthRoute,
} from "@/lib/i18n/pathname-without-locale";
import { routing } from "@/i18n/routing";

/**
 * Opt out: AUTH_ROUTE_GUARD=0
 * When unset / any other value, guards run whenever Supabase is configured.
 */
export function isAuthRouteGuardEnabled(): boolean {
  return process.env.AUTH_ROUTE_GUARD !== "0";
}

/**
 * Routes that require a signed-in Cookie session.
 * Marketing / legal / landing stay public.
 * Start narrow: workspace shell + paid chat sessions only.
 */
export function isAuthProtectedPath(pathname: string): boolean {
  const path = getPathnameWithoutLocale(pathname);
  if (path === "/app" || path.startsWith("/app/")) return true;
  if (path.startsWith("/poju/session/")) return true;
  return false;
}

function localeFromPathname(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && (routing.locales as readonly string[]).includes(first)) {
    return first;
  }
  return routing.defaultLocale;
}

function loginPathForLocale(locale: string): string {
  if (locale === routing.defaultLocale) return "/login";
  return `/${locale}/login`;
}

function completeEmailPathForLocale(locale: string): string {
  if (locale === routing.defaultLocale) return "/complete-email";
  return `/${locale}/complete-email`;
}

/** Prefix a safe relative path with locale when needed (strips any existing prefix first). */
function localizedPath(locale: string, path: string): string {
  const pathOnly = (path.split("?")[0] || "/").trim() || "/";
  const bare = getPathnameWithoutLocale(pathOnly) || "/";
  if (locale === routing.defaultLocale) return bare;
  if (bare === "/") return `/${locale}`;
  return `/${locale}${bare}`;
}

/**
 * `next` query value: keep locale prefix for non-default locales so
 * `window.location.replace(next)` after OAuth does not drop into English `/app`.
 */
function nextParamForRequest(locale: string, pathNoLocale: string, search: string): string {
  const bare = `${pathNoLocale}${search}`;
  if (locale === routing.defaultLocale) {
    return safeNextPath(bare, "/app");
  }
  const prefixed =
    bare === "/" || bare === ""
      ? `/${locale}`
      : `/${locale}${bare.startsWith("/") ? bare : `/${bare}`}`;
  return safeNextPath(prefixed, `/${locale}/app`);
}

function copyCookies(from: NextResponse, to: NextResponse): void {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

/**
 * After intl + session refresh: redirect unauthenticated users away from
 * protected routes to `/login?next=...`, and users without email to `/complete-email`.
 */
export function applyAuthRouteGuard(
  request: NextRequest,
  response: NextResponse,
  user: User | null,
): NextResponse {
  if (!isSupabaseConfigured()) return response;
  if (!isAuthRouteGuardEnabled()) return response;

  const pathname = request.nextUrl.pathname;
  const pathNoLocale = getPathnameWithoutLocale(pathname);
  const locale = localeFromPathname(pathname);
  const search = request.nextUrl.search || "";

  // Signed in but missing email → hard gate before protected app use
  if (user && userNeedsEmail(user) && isAuthProtectedPath(pathname)) {
    if (pathNoLocale === "/complete-email" || pathNoLocale.startsWith("/complete-email/")) {
      return response;
    }
    const next = nextParamForRequest(locale, pathNoLocale, search);
    const gateUrl = request.nextUrl.clone();
    gateUrl.pathname = completeEmailPathForLocale(locale);
    gateUrl.search = "";
    gateUrl.searchParams.set("next", next);
    const redirect = NextResponse.redirect(gateUrl);
    copyCookies(response, redirect);
    return redirect;
  }

  // Already signed in → leave login/signup (OAuth may set cookies without a client nav)
  if (
    user &&
    !userNeedsEmail(user) &&
    (pathNoLocale === "/login" ||
      pathNoLocale === "/signup" ||
      pathNoLocale.startsWith("/login/") ||
      pathNoLocale.startsWith("/signup/"))
  ) {
    const nextRaw = safeNextPath(request.nextUrl.searchParams.get("next"), "/");
    const dest = new URL(nextRaw, request.nextUrl.origin);
    // Prefer locale embedded in `next` (e.g. /zh/app); else the auth page locale.
    const nextLocale = localeFromPathname(dest.pathname);
    const useLocale = nextLocale !== routing.defaultLocale ? nextLocale : locale;
    dest.pathname = localizedPath(useLocale, dest.pathname || "/");
    const redirect = NextResponse.redirect(dest);
    copyCookies(response, redirect);
    return redirect;
  }

  if (isAuthRoute(pathname)) return response;
  if (!isAuthProtectedPath(pathname)) return response;
  if (user) return response;

  const next = nextParamForRequest(locale, pathNoLocale, search);
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = loginPathForLocale(locale);
  loginUrl.search = "";
  loginUrl.searchParams.set("next", next);

  const redirect = NextResponse.redirect(loginUrl);
  copyCookies(response, redirect);
  return redirect;
}
