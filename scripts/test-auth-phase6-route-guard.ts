/**
 * Phase 6 smoke: auth route guard helpers + middleware composition.
 * Run: pnpm exec tsx scripts/test-auth-phase6-route-guard.ts
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const root = process.cwd();
  assert(existsSync(path.join(root, "lib/auth/middleware-guard.ts")), "middleware-guard exists");

  const {
    isAuthProtectedPath,
    applyAuthRouteGuard,
    isAuthRouteGuardEnabled,
  } = await import("../lib/auth/middleware-guard");

  assert(isAuthProtectedPath("/app") === true, "/app protected");
  assert(isAuthProtectedPath("/app?tab=atmos".split("?")[0]!) === true, "/app path");
  assert(isAuthProtectedPath("/zh/app") === true, "/zh/app protected");
  assert(isAuthProtectedPath("/poju/session/abc") === true, "session protected");
  assert(isAuthProtectedPath("/zh/poju/session/abc") === true, "locale session protected");
  assert(isAuthProtectedPath("/") === false, "home public");
  assert(isAuthProtectedPath("/login") === false, "login not protected-path");
  assert(isAuthProtectedPath("/poju") === false, "poju marketing public");
  assert(isAuthProtectedPath("/contact") === false, "contact public");

  const { userNeedsEmail } = await import("../lib/auth/user-identity");
  assert(userNeedsEmail(null) === false, "null user no email need");
  assert(userNeedsEmail({ email: "" } as never) === true, "empty email needs gate");
  assert(userNeedsEmail({ email: "a@b.co" } as never) === false, "email present ok");

  const prev = process.env.AUTH_ROUTE_GUARD;
  process.env.AUTH_ROUTE_GUARD = "0";
  assert(isAuthRouteGuardEnabled() === false, "guard off via env");
  process.env.AUTH_ROUTE_GUARD = prev;

  // When Supabase unset, guard is a no-op even for protected paths.
  const { isSupabaseConfigured } = await import("../lib/auth/supabase");
  const req = new NextRequest("http://localhost:3000/app?tab=atmos");
  const passthrough = NextResponse.next();
  const out = applyAuthRouteGuard(req, passthrough, null);
  if (!isSupabaseConfigured()) {
    assert(out === passthrough, "no supabase → no redirect");
  } else if (process.env.AUTH_ROUTE_GUARD === "0") {
    assert(out === passthrough, "guard disabled → no redirect");
  } else {
    assert(out.status === 307 || out.status === 302, "redirect when supabase on + no user");
    const loc = out.headers.get("location") ?? "";
    assert(loc.includes("/login"), `redirect to login, got ${loc}`);
    assert(loc.includes("next="), "next param present");
  }

  // Locale login path
  const reqZh = new NextRequest("http://localhost:3000/zh/app");
  process.env.AUTH_ROUTE_GUARD = "1";
  if (isSupabaseConfigured()) {
    const redirected = applyAuthRouteGuard(reqZh, NextResponse.next(), null);
    const loc = redirected.headers.get("location") ?? "";
    assert(loc.includes("/zh/login"), `zh login redirect, got ${loc}`);
    assert(decodeURIComponent(loc).includes("next=/zh/app"), "next keeps zh locale prefix");
  }
  if (prev === undefined) delete process.env.AUTH_ROUTE_GUARD;
  else process.env.AUTH_ROUTE_GUARD = prev;

  const mw = readFileSync(path.join(root, "middleware.ts"), "utf8");
  assert(mw.includes("createMiddleware"), "keeps intl");
  assert(mw.includes("updateSupabaseSession"), "session refresh");
  assert(mw.includes("applyAuthRouteGuard"), "applies guard");
  assert(mw.includes("sessionUncertain"), "middleware passes soft-fail through the guard");

  const {
    resolveMiddlewareAuthOutcome,
    isDefinitiveAuthLogout,
    isSoftAuthFailure,
    copyResponseCookies,
    hasSupabaseSessionCookie,
  } = await import("../lib/auth/session-cookie-policy");

  assert(
    hasSupabaseSessionCookie([{ name: "sb-ref-auth-token.0", value: "abc" }]),
    "chunked session cookie counts",
  );
  assert(
    !hasSupabaseSessionCookie([{ name: "sb-ref-auth-token-code-verifier", value: "abc" }]),
    "pkce verifier is not a session",
  );
  assert(
    !hasSupabaseSessionCookie([{ name: "sb-ref-auth-token", value: "  " }]),
    "empty auth cookie is not a live session",
  );

  const soft = { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" };
  assert(isSoftAuthFailure(soft), "fetch failure is soft");
  assert(!isDefinitiveAuthLogout(soft), "fetch failure is not a logout");
  const kept = resolveMiddlewareAuthOutcome({
    user: null,
    error: soft,
    hadSessionCookie: true,
  });
  assert(kept.sessionUncertain === true, "soft fail with cookie stays uncertain");
  assert(kept.commitCookieWrites === false, "soft fail does not commit cookie clears");

  const dead = { name: "AuthApiError", status: 401, code: "refresh_token_not_found", message: "Invalid Refresh Token" };
  assert(isDefinitiveAuthLogout(dead), "revoked refresh is a logout");
  const dropped = resolveMiddlewareAuthOutcome({
    user: null,
    error: dead,
    hadSessionCookie: true,
  });
  assert(dropped.sessionUncertain === false, "definitive logout is not uncertain");
  assert(dropped.commitCookieWrites === true, "definitive logout may clear cookies");

  const missingLocal = { name: "AuthSessionMissingError", message: "Auth session missing!" };
  assert(!isDefinitiveAuthLogout(missingLocal), "local session-missing does not wipe a present cookie");
  const unreadable = resolveMiddlewareAuthOutcome({
    user: null,
    error: missingLocal,
    hadSessionCookie: true,
  });
  assert(unreadable.sessionUncertain && !unreadable.commitCookieWrites, "unreadable cookie is preserved");

  const loggedOut = resolveMiddlewareAuthOutcome({
    user: null,
    error: missingLocal,
    hadSessionCookie: false,
  });
  assert(!loggedOut.sessionUncertain && loggedOut.commitCookieWrites, "no cookie still logs out");

  // Force the guard on even when this machine has no Supabase env.
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const prevGuard = process.env.AUTH_ROUTE_GUARD;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.AUTH_ROUTE_GUARD = "1";
  try {
    const appReq = new NextRequest("http://localhost:3000/app?tab=poju");
    const stay = NextResponse.next();
    const keptResponse = applyAuthRouteGuard(appReq, stay, null, { sessionUncertain: true });
    assert(keptResponse === stay, "Continue soft-fail does not replace the /app response");
    assert(keptResponse.status === 200, "uncertain session stays on /app");

    const bounced = applyAuthRouteGuard(appReq, NextResponse.next(), null);
    assert(bounced.status === 307 || bounced.status === 302, "real signed-out still redirects");
    const loc = decodeURIComponent(bounced.headers.get("location") ?? "");
    assert(loc.includes("/login"), `login redirect, got ${loc}`);
    assert(loc.includes("next=/app?tab=poju"), `next keeps tab, got ${loc}`);

    const from = NextResponse.next();
    from.cookies.set("sb-ref-auth-token", "rotated", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });
    from.headers.set("cache-control", "private, no-store");
    const redirect = NextResponse.redirect("http://localhost:3000/login?next=/app");
    copyResponseCookies(from, redirect);
    const setCookie = redirect.headers.getSetCookie().join("\n");
    assert(/httponly/i.test(setCookie), `redirect keeps HttpOnly, got ${setCookie}`);
    assert(/max-age=3600/i.test(setCookie), `redirect keeps Max-Age, got ${setCookie}`);
    assert(
      (redirect.headers.get("cache-control") ?? "").includes("no-store"),
      "redirect keeps auth cache-control",
    );

    const clearing = NextResponse.next();
    clearing.cookies.set("sb-ref-auth-token", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
    });
    const loginRedirect = NextResponse.redirect("http://localhost:3000/login");
    copyResponseCookies(clearing, loginRedirect);
    const clearHeader = loginRedirect.headers.getSetCookie().join("\n");
    assert(/max-age=0/i.test(clearHeader), `clear cookie keeps Max-Age=0, got ${clearHeader}`);
  } finally {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;
    if (prevGuard === undefined) delete process.env.AUTH_ROUTE_GUARD;
    else process.env.AUTH_ROUTE_GUARD = prevGuard;
  }

  const meRoute = readFileSync(path.join(root, "app/api/auth/me/route.ts"), "utf8");
  assert(meRoute.includes("session_uncertain"), "auth/me reports soft lookup failure");
  assert(meRoute.includes("503"), "auth/me soft failure is not a 200 logged-out body");
  const checkout = readFileSync(path.join(root, "lib/passes/start-checkout.ts"), "utf8");
  assert(checkout.includes("!meRes.ok"), "checkout does not login-redirect on a failed me probe");

  console.log("test-auth-phase6-route-guard: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
