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
    assert(decodeURIComponent(loc).includes("next=/app"), "next strips locale prefix");
  }
  if (prev === undefined) delete process.env.AUTH_ROUTE_GUARD;
  else process.env.AUTH_ROUTE_GUARD = prev;

  const mw = readFileSync(path.join(root, "middleware.ts"), "utf8");
  assert(mw.includes("createMiddleware"), "keeps intl");
  assert(mw.includes("updateSupabaseSession"), "session refresh");
  assert(mw.includes("applyAuthRouteGuard"), "applies guard");

  console.log("test-auth-phase6-route-guard: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
