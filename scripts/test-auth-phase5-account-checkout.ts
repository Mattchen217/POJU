/**
 * Phase 5 smoke: account chip wiring + checkout uses getServerUser.
 * Run: pnpm exec tsx scripts/test-auth-phase5-account-checkout.ts
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

function mustNotInclude(rel: string, needles: string[]) {
  const src = readFileSync(path.join(process.cwd(), rel), "utf8");
  for (const n of needles) {
    assert(!src.includes(n), `${rel} should not include "${n}"`);
  }
}

async function main() {
  const root = process.cwd();

  for (const rel of [
    "lib/auth/use-auth-user.ts",
    "components/workspace/panels/ProfilePanel.tsx",
    "components/workspace/WorkspaceSidebar.tsx",
    "app/api/checkout/create/route.ts",
  ]) {
    assert(existsSync(path.join(root, rel)), `missing ${rel}`);
  }

  mustInclude("app/api/checkout/create/route.ts", ["getServerUser", "unauthorized"]);
  mustInclude("components/workspace/WorkspaceSidebar.tsx", ["useAuthUser", "/login"]);
  mustInclude("components/workspace/panels/ProfilePanel.tsx", [
    "useAuthUser",
    "signOut",
    "/api/auth/update-password",
  ]);
  mustInclude("lib/auth/use-auth-user.ts", ["createSupabaseBrowserClient", "/api/auth/logout"]);

  mustInclude("public/v2-landing.html", ["credentials: 'same-origin'"]);
  mustNotInclude("public/v2-landing.html", ["access_token: accessToken"]);
  mustInclude("docs/visual-reference/v2-workspace-landing.html", ["credentials: 'same-origin'"]);

  const { POST } = await import("../app/api/checkout/create/route");
  const res = await POST(
    new Request("http://localhost/api/checkout/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: { plan: "flex_pass", quantity: 1 },
        locale: "en",
      }),
    }),
  );
  const data = (await res.json()) as Record<string, unknown>;

  // Without Cookie session: either mock checkout (no Supabase) or 401.
  if (res.status === 200) {
    assert(data.ok === true && typeof data.checkout_url === "string", "mock checkout ok");
  } else {
    assert(res.status === 401 && data.error === "unauthorized", "requires session when Supabase on");
  }

  console.log("test-auth-phase5-account-checkout: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
