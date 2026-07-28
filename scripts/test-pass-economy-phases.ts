/**
 * Pass economy Phases 2–5 structural smoke.
 * Run: pnpm exec tsx scripts/test-pass-economy-phases.ts
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

function mustInclude(rel: string, needles: string[]) {
  const src = read(rel);
  for (const n of needles) {
    assert(src.includes(n), `${rel} missing "${n}"`);
  }
}

async function main() {
  for (const rel of [
    "supabase/migrations/20260728_pass_usage_and_subscription.sql",
    "supabase/migrations/20260729_pass_dual_balance_atmos.sql",
    "lib/passes/consume-pass.ts",
    "lib/passes/credit-passes.ts",
    "lib/passes/types.ts",
    "lib/passes/unlock-with-pass.ts",
    "app/api/account/summary/route.ts",
    "app/api/account/portal/route.ts",
    "app/api/checkout/confirm/route.ts",
    "app/api/passes/unlock/route.ts",
    "app/api/passes/atmos-status/route.ts",
    "components/account/PassBalanceCard.tsx",
    "components/account/SubscriptionCard.tsx",
    "components/account/PurchaseHistoryList.tsx",
    "components/account/UsageHistoryList.tsx",
    "components/account/CheckoutConfirmBanner.tsx",
    "components/workspace/panels/ProfilePanel.tsx",
    "app/api/webhooks/stripe/route.ts",
    "app/api/poju/final-delivery/route.ts",
    "components/auth/ResumePendingCheckout.tsx",
  ]) {
    assert(existsSync(path.join(process.cwd(), rel)), `missing ${rel}`);
  }

  mustInclude("supabase/migrations/20260729_pass_dual_balance_atmos.sql", [
    "flex_balance",
    "sub_balance",
    "credit_flex_passes",
    "grant_atmos_entitlement",
    "atmos_entitlements",
  ]);

  mustInclude("lib/passes/consume-pass.ts", [
    "assertAndConsumePass",
    "isPassEnforceEnabled",
    "PASS_ENFORCE_PRODUCTS",
    '?? "all"',
    "SUBSCRIPTION_MONTHLY_QUOTA",
  ]);

  mustInclude("app/api/account/summary/route.ts", [
    "getServerUser",
    "flex_balance",
    "sub_quota",
    "pass_usage",
    "payment_records",
  ]);

  mustInclude("app/api/checkout/confirm/route.ts", [
    "creditPassesFromCheckout",
    "mock_cs_",
    "gateway_placeholder",
  ]);

  mustInclude("app/api/passes/unlock/route.ts", [
    "assertAndConsumePass",
    "grant_atmos_entitlement",
    "already_entitled",
  ]);

  mustInclude("components/workspace/panels/ProfilePanel.tsx", [
    "/api/account/summary",
    "PassBalanceCard",
    "CheckoutConfirmBanner",
    "UsageHistoryList",
  ]);

  mustInclude("app/api/webhooks/stripe/route.ts", [
    "invoice.paid",
    "customer.subscription.deleted",
    "topup_subscription_passes",
    "subscription_cycle",
    "creditPassesFromCheckout",
  ]);

  mustInclude("lib/payments/create-checkout-session.ts", [
    "ensureStripeCustomer",
    "stripe_customer_id",
    "subscription_data",
  ]);

  mustInclude("app/api/poju/final-delivery/route.ts", [
    "assertAndConsumePass",
    "isPassEnforceEnabled",
    "pass_required",
  ]);

  mustInclude("app/api/checkout/create/route.ts", ["getServerUser", "unauthorized"]);

  mustInclude("app/[locale]/(workspace)/app/page.tsx", ["ResumePendingCheckout"]);

  mustInclude("messages/en.json", [
    '"account"',
    "passBalance",
    "subPassHint",
    "checkoutCredited",
    "usageHistory",
  ]);
  mustInclude("messages/zh.json", ['"account"', "passBalance", "subPassHint"]);

  console.log("test-pass-economy-phases: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
