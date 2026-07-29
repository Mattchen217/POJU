import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";

export type SchedulePlanChangeResult = {
  ok: boolean;
  reason?: string;
  mock?: boolean;
  plan?: string | null;
  pending_plan?: string | null;
  current_period_end?: string | null;
};

/**
 * Schedule a plan switch for the next billing cycle.
 * Does not change current plan / quota until renewal applies it.
 */
export async function scheduleSubscriptionPlanChange(params: {
  userId: string;
  pendingPlan: "personal" | "team" | null;
}): Promise<SchedulePlanChangeResult> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error: readErr } = await admin
    .from("user_passes")
    .select(
      "subscription_status, subscription_plan, pending_subscription_plan, current_period_end, stripe_subscription_id",
    )
    .eq("user_id", params.userId)
    .maybeSingle();

  if (readErr) {
    console.error("[passes] schedule plan read", readErr.code ?? readErr.message);
    return { ok: false, reason: "lookup_failed" };
  }

  const currentPlan =
    row?.subscription_plan === "personal" || row?.subscription_plan === "team"
      ? row.subscription_plan
      : null;

  if (!currentPlan && !row?.stripe_subscription_id) {
    return { ok: false, reason: "no_subscription" };
  }

  if (params.pendingPlan && params.pendingPlan === currentPlan) {
    // Same as current → clear any pending switch
    const { error: clearErr } = await admin
      .from("user_passes")
      .update({
        pending_subscription_plan: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", params.userId);
    if (clearErr) {
      console.error("[passes] schedule plan clear", clearErr.code ?? clearErr.message);
      return { ok: false, reason: "update_failed" };
    }
    return {
      ok: true,
      mock: !isPaymentGatewayEnabled(),
      plan: currentPlan,
      pending_plan: null,
      current_period_end: row?.current_period_end ?? null,
    };
  }

  if (isPaymentGatewayEnabled()) {
    // TODO: Stripe Subscription Schedule / update price at period end
    console.info("[passes] schedule plan change placeholder", {
      userId: params.userId.slice(0, 8),
      from: currentPlan,
      to: params.pendingPlan,
    });
  }

  const { error: writeErr } = await admin
    .from("user_passes")
    .update({
      pending_subscription_plan: params.pendingPlan,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId);

  if (writeErr) {
    console.error("[passes] schedule plan write", writeErr.code ?? writeErr.message);
    return { ok: false, reason: "update_failed" };
  }

  return {
    ok: true,
    mock: !isPaymentGatewayEnabled(),
    plan: currentPlan,
    pending_plan: params.pendingPlan,
    current_period_end: row?.current_period_end ?? null,
  };
}

/**
 * Apply pending plan on renewal: returns effective plan for top-up and clears pending.
 */
export async function applyPendingPlanOnRenewal(params: {
  userId: string;
  fallbackPlan: "personal" | "team" | null;
}): Promise<"personal" | "team" | null> {
  if (!isSupabaseAdminConfigured()) return params.fallbackPlan;

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("user_passes")
    .select("subscription_plan, pending_subscription_plan")
    .eq("user_id", params.userId)
    .maybeSingle();

  const pending =
    row?.pending_subscription_plan === "personal" || row?.pending_subscription_plan === "team"
      ? row.pending_subscription_plan
      : null;
  const current =
    row?.subscription_plan === "personal" || row?.subscription_plan === "team"
      ? row.subscription_plan
      : params.fallbackPlan;

  const effective = pending ?? current ?? params.fallbackPlan;
  if (!effective) return null;

  await admin
    .from("user_passes")
    .update({
      subscription_plan: effective,
      pending_subscription_plan: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId);

  return effective;
}
