/**
 * Phase 2 smoke: auth helpers + API routes (mock mode when Supabase unset).
 * Run: pnpm exec tsx scripts/test-auth-phase2-apis.ts
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function jsonPost(
  handler: (req: Request) => Promise<Response>,
  body: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await handler(
    new Request("http://localhost/api/auth/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

async function main() {
  const root = process.cwd();

  const routes = [
    "app/api/auth/signup/route.ts",
    "app/api/auth/verify-signup/route.ts",
    "app/api/auth/login/route.ts",
    "app/api/auth/logout/route.ts",
    "app/api/auth/forgot-password/route.ts",
    "app/api/auth/update-password/route.ts",
    "app/api/auth/callback/route.ts",
    "app/api/auth/confirm/route.ts",
    "app/api/auth/otp/send/route.ts",
    "app/api/auth/otp/verify/route.ts",
  ];
  for (const rel of routes) {
    assert(existsSync(path.join(root, rel)), `missing ${rel}`);
  }

  const { safeNextPath, mapAuthErrorCode, normalizeEmail } = await import(
    "../lib/auth/auth-helpers"
  );
  assert(safeNextPath("/app") === "/app", "safe next /app");
  assert(safeNextPath("//evil.com") === "/app", "block protocol-relative");
  assert(safeNextPath("https://evil.com") === "/app", "block absolute");
  assert(safeNextPath("/reset-password") === "/reset-password", "allow reset");
  assert(normalizeEmail("  A@B.Com ") === "a@b.com", "normalize email");
  assert(mapAuthErrorCode("Invalid login credentials") === "invalid_credentials", "map creds");
  assert(mapAuthErrorCode("Email not confirmed") === "email_not_confirmed", "map unconfirmed");

  const otpVerifySrc = readFileSync(path.join(root, "app/api/auth/otp/verify/route.ts"), "utf8");
  assert(otpVerifySrc.includes("createSupabaseServerClient"), "otp/verify uses server client (Cookie)");
  assert(!otpVerifySrc.includes("createSupabaseAnonClient"), "otp/verify no longer anon-only");

  const { isSupabaseConfigured } = await import("../lib/auth/supabase");
  if (isSupabaseConfigured()) {
    console.log("Supabase env present — skipping mock handler asserts");
  } else {
    const { POST: signup } = await import("../app/api/auth/signup/route");
    const { POST: login } = await import("../app/api/auth/login/route");
    const { POST: forgot } = await import("../app/api/auth/forgot-password/route");
    const { POST: verifyOtp } = await import("../app/api/auth/otp/verify/route");
    const { POST: verifySignup } = await import("../app/api/auth/verify-signup/route");
    const { POST: logout } = await import("../app/api/auth/logout/route");

    const s = await jsonPost(signup, { email: "demo@example.com", password: "password12" });
    assert(s.status === 200 && s.data.ok === true && s.data.mocked === true, "signup mock");

    const l = await jsonPost(login, { email: "demo@example.com", password: "password12" });
    assert(l.status === 200 && l.data.ok === true && l.data.mocked === true, "login mock");

    const f = await jsonPost(forgot, { email: "demo@example.com" });
    assert(f.status === 200 && f.data.ok === true, "forgot-password always-ok shape");

    const v = await jsonPost(verifyOtp, { email: "demo@example.com", token: "123456" });
    assert(v.status === 200 && v.data.ok === true && v.data.mocked === true, "otp verify mock");

    const vs = await jsonPost(verifySignup, { email: "demo@example.com", token: "123456" });
    assert(vs.status === 200 && vs.data.ok === true, "verify-signup mock");

    const lo = await jsonPost(logout, {});
    assert(lo.status === 200 && lo.data.ok === true, "logout mock");

    console.log("mock API handlers: OK");
  }

  console.log("test-auth-phase2-apis: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
