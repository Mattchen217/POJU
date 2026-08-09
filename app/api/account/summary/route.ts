import { NextResponse } from "next/server";

import { getServerUser, createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

export const runtime = "nodejs";

/**
 * Account page data: Pass balance, subscription, purchases, usage.
 * Identity from Cookie session only.
 */
export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }

    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    const [passesRes, purchasesRes, usageRes, atmosRes, profileRes] = await Promise.all([
      supabase
        .from("user_passes")
        .select(
          "pass_balance, flex_balance, sub_balance, sub_quota, sub_carryover, carryover_source_plan, subscription_status, subscription_plan, pending_subscription_plan, current_period_end, stripe_subscription_id, updated_at",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("payment_records")
        .select(
          "id, plan_type, quantity, amount_cents, currency, status, created_at, stripe_session_id",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("pass_usage")
        .select("id, product, ref_id, description, pass_source, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("atmos_entitlements")
        .select("record_key, starts_at, ends_at, pass_usage_ref")
        .eq("user_id", user.id)
        .gt("ends_at", new Date().toISOString())
        .order("ends_at", { ascending: false })
        .limit(20),
      supabase
        .from("profiles")
        .select("stripe_customer_id, notify_pass_low, notify_marketing, display_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (passesRes.error) {
      console.error("[account/summary] user_passes", passesRes.error.code);
    }
    if (purchasesRes.error) {
      console.error("[account/summary] payment_records", purchasesRes.error.code);
    }
    if (usageRes.error) {
      console.error("[account/summary] pass_usage", usageRes.error.code);
    }
    if (atmosRes.error) {
      console.error("[account/summary] atmos_entitlements", atmosRes.error.code);
    }
    if (profileRes.error) {
      console.error("[account/summary] profiles", profileRes.error.code);
    }

    const passes = passesRes.data;
    const profile = profileRes.data;
    const flex =
      typeof passes?.flex_balance === "number"
        ? passes.flex_balance
        : typeof passes?.pass_balance === "number"
          ? passes.pass_balance
          : 0;
    const sub = typeof passes?.sub_balance === "number" ? passes.sub_balance : 0;
    const quota = typeof passes?.sub_quota === "number" ? passes.sub_quota : 0;
    const carryover =
      typeof passes?.sub_carryover === "number" ? passes.sub_carryover : 0;
    const carryoverSource =
      passes?.carryover_source_plan === "personal" ||
      passes?.carryover_source_plan === "team"
        ? passes.carryover_source_plan
        : null;
    const total =
      typeof passes?.pass_balance === "number"
        ? passes.pass_balance
        : flex + sub + carryover;

    return NextResponse.json({
      ok: true,
      email: user.email ?? null,
      has_stripe_customer: Boolean(profile?.stripe_customer_id?.trim()),
      notify_pass_low: profile?.notify_pass_low ?? true,
      notify_marketing: profile?.notify_marketing ?? false,
      display_name: profile?.display_name ?? null,
      pass_balance: total,
      flex_balance: flex,
      sub_balance: sub,
      sub_quota: quota,
      sub_carryover: carryover,
      carryover_source_plan: carryoverSource,
      subscription: {
        status: passes?.subscription_status ?? "none",
        plan: passes?.subscription_plan ?? null,
        pending_plan:
          passes?.pending_subscription_plan === "personal" ||
          passes?.pending_subscription_plan === "team"
            ? passes.pending_subscription_plan
            : null,
        current_period_end: passes?.current_period_end ?? null,
        stripe_subscription_id: passes?.stripe_subscription_id ?? null,
        remaining: sub,
        quota,
        carryover,
        carryover_source_plan: carryoverSource,
        available_subscription_passes: sub + carryover,
      },
      purchases: purchasesRes.data ?? [],
      usage: usageRes.data ?? [],
      atmos_entitlements: atmosRes.data ?? [],
    });
  } catch (error) {
    console.error("[account/summary]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "summary_failed" }, { status: 500 });
  }
}
