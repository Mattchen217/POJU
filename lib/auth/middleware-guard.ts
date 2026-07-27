import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/auth-helpers";
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

function copyCookies(from: NextResponse, to: NextResponse): void {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

/**
 * After intl + session refresh: redirect unauthenticated users away from
 * protected routes to `/login?next=<path-without-locale>`.
 */
export function applyAuthRouteGuard(
  request: NextRequest,
  response: NextResponse,
  user: User | null,
): NextResponse {
  if (!isSupabaseConfigured()) return response;
  if (!isAuthRouteGuardEnabled()) return response;

  const pathname = request.nextUrl.pathname;
  if (isAuthRoute(pathname)) return response;
  if (!isAuthProtectedPath(pathname)) return response;
  if (user) return response;

  const pathNoLocale = getPathnameWithoutLocale(pathname);
  const search = request.nextUrl.search || "";
  const next = safeNextPath(`${pathNoLocale}${search}`, "/app");
  const locale = localeFromPathname(pathname);

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = loginPathForLocale(locale);
  loginUrl.search = "";
  loginUrl.searchParams.set("next", next);

  const redirect = NextResponse.redirect(loginUrl);
  copyCookies(response, redirect);
  return redirect;
}
