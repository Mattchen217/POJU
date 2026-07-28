/**
 * Phase 3 smoke: auth UI pages + components exist and wire expected API paths.
 * Run: pnpm exec tsx scripts/test-auth-phase3-ui.ts
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function mustInclude(rel: string, needles: string[]) {
  const src = readFileSync(path.join(process.cwd(), rel), "utf8");
  for (const n of needles) {
    assert(src.includes(n), `${rel} missing "${n}"`);
  }
}

function main() {
  const root = process.cwd();

  const files = [
    "app/[locale]/(auth)/layout.tsx",
    "app/[locale]/(auth)/login/page.tsx",
    "app/[locale]/(auth)/signup/page.tsx",
    "app/[locale]/(auth)/verify/page.tsx",
    "app/[locale]/(auth)/forgot-password/page.tsx",
    "app/[locale]/(auth)/reset-password/page.tsx",
    "components/auth/AuthCard.tsx",
    "components/auth/AuthErrorText.tsx",
    "components/auth/EmailPasswordForm.tsx",
    "components/auth/OAuthButtons.tsx",
    "components/auth/OtpCodeInput.tsx",
    "components/auth/PasswordStrengthHint.tsx",
    "components/auth/auth.css",
    "messages/en/auth.json",
    "lib/auth/post-auth-json.ts",
  ];

  for (const rel of files) {
    assert(existsSync(path.join(root, rel)), `missing ${rel}`);
  }

  mustInclude("app/[locale]/(auth)/login/page.tsx", ["/api/auth/login", "OAuthButtons", "Suspense"]);
  mustInclude("app/[locale]/(auth)/signup/page.tsx", ["/api/auth/signup", "mode=signup"]);
  mustInclude("app/[locale]/(auth)/verify/page.tsx", [
    "/api/auth/verify-signup",
    "/api/auth/otp/verify",
    "/api/auth/otp/send",
    "/api/auth/resend-signup",
    "OtpCodeInput",
  ]);
  assert(
    existsSync(path.join(root, "app/api/auth/resend-signup/route.ts")),
    "missing app/api/auth/resend-signup/route.ts",
  );
  mustInclude("app/[locale]/(auth)/forgot-password/page.tsx", ["/api/auth/forgot-password"]);
  mustInclude("app/[locale]/(auth)/reset-password/page.tsx", ["/api/auth/update-password"]);
  mustInclude("components/auth/OAuthButtons.tsx", [
    "signInWithOAuth",
    "/api/auth/callback",
    "skipBrowserRedirect",
  ]);
  mustInclude("app/api/auth/callback/route.ts", ["popup", "easternos-oauth-done"]);
  mustInclude("lib/auth/oauth-popup.ts", ["prefersFullPageOAuth", "openCenteredOAuthPopup"]);
  mustInclude("lib/i18n/pathname-without-locale.ts", ["isAuthRoute", "/forgot-password", "/reset-password"]);
  mustInclude("lib/i18n/load-locale-messages.ts", ['"auth"']);

  const authJson = JSON.parse(readFileSync(path.join(root, "messages/en/auth.json"), "utf8")) as {
    login?: { title?: string };
    errors?: Record<string, string>;
  };
  assert(authJson.login?.title === "Log in", "auth.json login.title");
  assert(typeof authJson.errors?.invalid_credentials === "string", "auth.json errors");

  console.log("test-auth-phase3-ui: ok");
}

main();
