import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { SUBSCRIPTION_FIRST_GRANT } from "@/lib/passes/consume-pass";

export type CreditPlanType = "flex_pass" | "personal" | "team";

export type CreditPassesResult = {
  ok: boolean;
  reason?: string;
  already?: boolean;
  flexAfter?: number;
  subAfter?: number;
  carryoverAfter?: number;
  totalAfter?: number;
  switched?: boolean;
};

type SubRow = {
  subscription_status: string | null;
  subscription_plan: string | null;
  stripe_subscription_id: string | null;
  sub_balance: number | null;
};

/**
 * Idempotent Pass credit after checkout (real webhook or mock confirm).
 * Flex → permanent bucket.
 * New subscribe → grant mode.
 * Existing subscriber changing plan → switch mode (merge remaining into carryover).
 */
export async function creditPassesFromCheckout(params: {
  userId: string;
  planType: string;
  quantity: number;
  sessionId: string;
  paymentIntentId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd?: string | null;
}): Promise<CreditPassesResult> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "admin_unconfigured" };
  }

  const planType =
    params.planType === "personal_plan"
      ? "personal"
      : params.planType === "team_plan"
        ? "team"
        : params.planType;

  let passesToAdd = 0;
  let planName: "personal" | "team" | null = null;

  if (planType === "flex_pass") {
    passesToAdd = Math.max(1, params.quantity);
  } else if (planType === "personal") {
    passesToAdd = SUBSCRIPTION_FIRST_GRANT.personal;
    planName = "personal";
  } else if (planType === "team") {
    passesToAdd = SUBSCRIPTION_FIRST_GRANT.team;
    planName = "team";
  } else {
    return { ok: false, reason: "invalid_plan" };
  }

  const admin = createSupabaseAdminClient();

  const { error: payErr } = await admin.from("payment_records").insert({
    user_id: params.userId,
    stripe_session_id: params.sessionId,
    stripe_payment_intent_id: params.paymentIntentId ?? null,
    plan_type: planType === "flex_pass" ? "flex_pass" : planName,
    quantity: params.quantity,
    amount_cents: params.amountCents ?? null,
    currency: params.currency ?? "usd",
    status: "completed",
  });

  if (payErr) {
    if (payErr.code === "23505") {
      return { ok: true, already: true, reason: "already_credited" };
    }
    console.error("[passes] payment_records", payErr.code);
    return { ok: false, reason: "payment_record_failed" };
  }

  if (planName) {
    const periodEnd =
      params.currentPeriodEnd ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: existing } = await admin
      .from("user_passes")
      .select("subscription_status, subscription_plan, stripe_subscription_id, sub_balance")
      .eq("user_id", params.userId)
      .maybeSingle();

    const row = existing as SubRow | null;
    const currentPlan =
      row?.subscription_plan === "personal" || row?.subscription_plan === "team"
        ? row.subscription_plan
        : null;
    const hasActiveSub =
      row?.subscription_status === "active" ||
      Boolean(row?.stripe_subscription_id?.trim()) ||
      Boolean(currentPlan);
    const isSwitch = Boolean(hasActiveSub && currentPlan && currentPlan !== planName);
    const mode = isSwitch ? "switch" : "grant";

    const { data, error } = await admin.rpc("credit_subscription_passes", {
      target_user_id: params.userId,
      passes_num: passesToAdd,
      plan_name: planName,
      period_end: periodEnd,
      mode,
    });
    if (error) {
      console.error("[passes] credit_subscription_passes", error.code ?? error.message);
      return { ok: false, reason: "credit_failed" };
    }
    const credited = Array.isArray(data) ? data[0] : data;

    const updates: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
      pending_subscription_plan: null,
    };
    if (params.subscriptionId) {
      updates.stripe_subscription_id = params.subscriptionId;
    }
    await admin.from("user_passes").update(updates).eq("user_id", params.userId);

    return {
      ok: true,
      switched: isSwitch,
      flexAfter: credited?.flex_after,
      subAfter: credited?.sub_after,
      carryoverAfter: credited?.carryover_after,
      totalAfter: credited?.total_after,
    };
  }

  const { data, error } = await admin.rpc("credit_flex_passes", {
    target_user_id: params.userId,
    passes_num: passesToAdd,
  });
  if (error) {
    console.error("[passes] credit_flex_passes", error.code ?? error.message);
    return { ok: false, reason: "credit_failed" };
  }
  const flexRow = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    flexAfter: flexRow?.flex_after,
    subAfter: flexRow?.sub_after,
    totalAfter: flexRow?.total_after,
  };
}
