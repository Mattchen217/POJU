/**
 * Phase 1 smoke: pass_usage migration SQL contains required objects.
 * Run: pnpm exec tsx scripts/test-pass-phase1-migration.ts
 *
 * Does not execute against live Supabase — apply the SQL in Dashboard SQL Editor
 * (or migration pipeline), then manually call consume_user_pass for idempotency.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const rel = "supabase/migrations/20260728_pass_usage_and_subscription.sql";
  const full = path.join(process.cwd(), rel);
  assert(existsSync(full), `missing ${rel}`);

  const sql = readFileSync(full, "utf8");
  const needles = [
    "CREATE TABLE IF NOT EXISTS public.pass_usage",
    "pass_usage_dedup_idx",
    "CREATE OR REPLACE FUNCTION public.consume_user_pass",
    "already_consumed",
    "insufficient_balance",
    "stripe_subscription_id",
    "current_period_end",
    "Users read own usage",
    "CREATE OR REPLACE FUNCTION public.topup_subscription_passes",
    "GREATEST(public.user_passes.pass_balance",
  ];
  for (const n of needles) {
    assert(sql.includes(n), `SQL missing: ${n}`);
  }

  const { isPassProduct, toPassProduct } = await import("../lib/passes/types");
  assert(isPassProduct("pivot"), "pivot product");
  assert(toPassProduct("poju") === "pivot", "poju → pivot");
  assert(toPassProduct("atmos") === "atmos", "atmos");

  const checkout = readFileSync(path.join(process.cwd(), "app/api/checkout/create/route.ts"), "utf8");
  assert(checkout.includes("getServerUser"), "checkout still Cookie-session based");

  console.log("test-pass-phase1-migration: ok");
  console.log("Next: apply supabase/migrations/20260728_pass_usage_and_subscription.sql in Supabase SQL Editor");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
