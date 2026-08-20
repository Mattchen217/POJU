import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

import { routing } from "./i18n/routing";
import { applyAuthRouteGuard } from "./lib/auth/middleware-guard";
import { updateSupabaseSession } from "./lib/auth/middleware-session";

const intlMiddleware = createMiddleware(routing);

function isLocaleHomePath(pathname: string): boolean {
  return pathname === "/" || /^\/(zh|es|fr)\/?$/.test(pathname);
}

/**
 * Compose next-intl → Supabase cookie refresh → optional auth route guard.
 * Do not replace intl — i18n depends on it.
 */
export default async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const oauthCode = url.searchParams.get("code");

  // OAuth PKCE can land on Site URL (/?code=…) — finish via server callback
  // (sets auth cookies) then redirect to next.
  if (oauthCode && isLocaleHomePath(url.pathname)) {
    const target = new URL("/api/auth/callback", url.origin);
    url.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });
    if (!target.searchParams.get("next")) {
      target.searchParams.set("next", "/");
    }
    return NextResponse.redirect(target);
  }

  const intlResponse = intlMiddleware(request);
  const { response, user } = await updateSupabaseSession(request, intlResponse);
  return applyAuthRouteGuard(request, response, user);
}

export const config = {
  matcher: [
    "/",
    "/(zh|es|fr)/:path*",
    "/((?!api|_next|_vercel|v2-landing|oracle-test|oracle-fronts-preview|unsubscribe|ops|kv|.*\\..*).*)",
  ],
};
