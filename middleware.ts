import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { applyAuthRouteGuard } from "./lib/auth/middleware-guard";
import { updateSupabaseSession } from "./lib/auth/middleware-session";

const intlMiddleware = createMiddleware(routing);

/**
 * Compose next-intl → Supabase cookie refresh → optional auth route guard.
 * Do not replace intl — i18n depends on it.
 */
export default async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);
  const { response, user } = await updateSupabaseSession(request, intlResponse);
  return applyAuthRouteGuard(request, response, user);
}

export const config = {
  matcher: [
    "/",
    "/(zh|es|de|fr)/:path*",
    "/((?!api|_next|_vercel|v2-landing|oracle-test|oracle-fronts-preview|unsubscribe|ops|kv|.*\\..*).*)",
  ],
};
