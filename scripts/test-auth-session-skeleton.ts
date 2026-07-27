/**
 * Phase 1 smoke: session skeleton modules load; middleware still exports matcher.
 * Run: pnpm exec tsx scripts/test-auth-session-skeleton.ts
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const root = process.cwd();
  const require = createRequire(import.meta.url);

  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  assert(Boolean(pkg.dependencies?.["@supabase/ssr"]), "@supabase/ssr in package.json");
  assert(Boolean(require.resolve("@supabase/ssr")), "@supabase/ssr resolves");

  assert(require.resolve("../lib/auth/supabase-server.ts"), "supabase-server");
  assert(require.resolve("../lib/auth/supabase-browser.ts"), "supabase-browser");
  assert(require.resolve("../lib/auth/middleware-session.ts"), "middleware-session");

  const mw = readFileSync(path.join(root, "middleware.ts"), "utf8");
  assert(mw.includes("createMiddleware"), "middleware keeps next-intl createMiddleware");
  assert(mw.includes("updateSupabaseSession"), "middleware calls updateSupabaseSession");
  assert(mw.includes("matcher"), "middleware exports matcher");
  assert(mw.includes("v2-landing"), "matcher still excludes v2-landing");
  assert(!mw.includes("export default createMiddleware(routing)"), "default is composed async middleware");

  const { isSupabaseConfigured } = await import("../lib/auth/supabase");
  assert(typeof isSupabaseConfigured === "function", "isSupabaseConfigured");

  const { getServerUser } = await import("../lib/auth/supabase-server");
  assert(typeof getServerUser === "function", "getServerUser");

  if (!isSupabaseConfigured()) {
    const user = await getServerUser();
    assert(user === null, "getServerUser returns null when Supabase unset");
    console.log("getServerUser(null env): null OK");
  } else {
    console.log("Supabase env present — skip null-env getServerUser assert");
  }

  console.log("test-auth-session-skeleton: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
