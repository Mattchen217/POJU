import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";

export type SubscriptionToggleResult = {
  ok: boolean;
  reason?: string;
  mock?: boolean;
  status?: string;
  plan?: string | null;
  current_period_end?: string | null;
};

/**
 * Toggle auto-renew: on = keep active, off = cancel at period end (placeholder).
 * TODO: wire Dodo/Stripe subscription cancel + resume when gateway is live.
 */
export async function setSubscriptionAutoRenew(params: {
  userId: string;
  active: boolean;
}): Promise<SubscriptionToggleResult> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error: readErr } = await admin
    .from("user_passes")
    .select("subscription_status, subscription_plan, current_period_end, stripe_subscription_id")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (readErr) {
    console.error("[passes] sub toggle read", readErr.code ?? readErr.message);
    return { ok: false, reason: "lookup_failed" };
  }

  const plan = row?.subscription_plan ?? null;
  if (!plan && !row?.stripe_subscription_id) {
    return { ok: false, reason: "no_subscription" };
  }

  if (isPaymentGatewayEnabled()) {
    // TODO: Dodo/Stripe cancel or resume subscription
    console.info("[passes] subscription toggle placeholder", {
      userId: params.userId.slice(0, 8),
      active: params.active,
    });
  }

  const nextStatus = params.active ? "active" : "canceled";
  const { error: writeErr } = await admin
    .from("user_passes")
    .update({
      subscription_status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId);

  if (writeErr) {
    console.error("[passes] sub toggle write", writeErr.code ?? writeErr.message);
    return { ok: false, reason: "update_failed" };
  }

  return {
    ok: true,
    mock: !isPaymentGatewayEnabled(),
    status: nextStatus,
    plan,
    current_period_end: row?.current_period_end ?? null,
  };
}
