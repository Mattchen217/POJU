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
  totalAfter?: number;
};

/**
 * Idempotent Pass credit after checkout (real webhook or mock confirm).
 * Flex → permanent bucket; personal/team → subscription bucket (30-day period).
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

  const planType = params.planType === "personal_plan"
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
    const { data, error } = await admin.rpc("credit_subscription_passes", {
      target_user_id: params.userId,
      passes_num: passesToAdd,
      plan_name: planName,
      period_end: periodEnd,
      mode: "grant",
    });
    if (error) {
      console.error("[passes] credit_subscription_passes", error.code ?? error.message);
      return { ok: false, reason: "credit_failed" };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (params.subscriptionId) {
      await admin
        .from("user_passes")
        .update({
          stripe_subscription_id: params.subscriptionId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", params.userId);
    }
    return {
      ok: true,
      flexAfter: row?.flex_after,
      subAfter: row?.sub_after,
      totalAfter: row?.total_after,
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
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    flexAfter: row?.flex_after,
    subAfter: row?.sub_after,
    totalAfter: row?.total_after,
  };
}
