import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/auth/supabase";
import { SUBSCRIPTION_MONTHLY_QUOTA } from "@/lib/passes/consume-pass";
import { creditPassesFromCheckout } from "@/lib/passes/credit-passes";
import { applyPendingPlanOnRenewal } from "@/lib/passes/schedule-plan-change";
import { createStripeClient, isStripeConfigured } from "@/lib/payments/create-checkout-session";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";

export const runtime = "nodejs";

async function creditPasses(params: {
  userId: string;
  planType: string;
  quantity: number;
  sessionId: string;
  paymentIntentId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd?: string | null;
}) {
  const result = await creditPassesFromCheckout(params);
  if (!result.ok && result.reason !== "already_credited") {
    throw new Error(result.reason ?? "credit_failed");
  }
}

async function resolveUserIdFromCustomer(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId || !isSupabaseAdminConfigured()) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Stripe SDK 22+: period lives on subscription items, not the Subscription root. */
function periodEndIso(sub: Stripe.Subscription): string | null {
  const end = sub.items?.data?.[0]?.current_period_end;
  if (typeof end !== "number") return null;
  return new Date(end * 1000).toISOString();
}

/** Stripe Basil+: invoice.subscription → parent.subscription_details.subscription */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

function invoiceSubscriptionMetadata(invoice: Stripe.Invoice): Stripe.Metadata | null {
  return invoice.parent?.subscription_details?.metadata ?? null;
}

/** Optional PaymentIntent id from expanded invoice.payments (Basil removed invoice.payment_intent). */
function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const payment = invoice.payments?.data?.[0]?.payment;
  if (!payment || payment.type !== "payment_intent") return null;
  const pi = payment.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!isSupabaseAdminConfigured()) return;

  const billingReason = invoice.billing_reason;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const subscriptionId = invoiceSubscriptionId(invoice);
  const subMeta = invoiceSubscriptionMetadata(invoice);

  let userId =
    (subMeta?.user_id as string | undefined) ||
    (invoice.metadata?.user_id as string | undefined) ||
    null;

  if (!userId) {
    userId = await resolveUserIdFromCustomer(customerId);
  }

  if (!userId) {
    console.error("[webhooks/stripe] invoice.paid missing user", invoice.id);
    return;
  }

  const admin = createSupabaseAdminClient();
  let planType: "personal" | "team" | null = null;

  if (subscriptionId && isStripeConfigured()) {
    const stripe = createStripeClient();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const metaPlan = sub.metadata?.plan_type ?? subMeta?.plan_type;
    if (metaPlan === "personal" || metaPlan === "team") planType = metaPlan;
    await admin
      .from("user_passes")
      .update({
        stripe_subscription_id: subscriptionId,
        current_period_end: periodEndIso(sub),
        subscription_status: sub.status === "active" ? "active" : "canceled",
        // Keep current plan until renewal applies pending; only set if empty
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  // First month credited on checkout.session.completed — renewals only here (strategy B).
  if (billingReason !== "subscription_cycle") {
    return;
  }

  // Apply scheduled plan switch at cycle boundary (true next-period change).
  planType = await applyPendingPlanOnRenewal({
    userId,
    fallbackPlan: planType,
  });
  if (!planType) {
    return;
  }

  // Keep Stripe metadata in sync when possible
  if (subscriptionId && isStripeConfigured()) {
    try {
      const stripe = createStripeClient();
      await stripe.subscriptions.update(subscriptionId, {
        metadata: { plan_type: planType, user_id: userId },
      });
    } catch (err) {
      console.error(
        "[webhooks/stripe] pending plan metadata",
        err instanceof Error ? err.name : "unknown",
      );
    }
  }

  const idempotencyKey = `inv_${invoice.id}`;
  const { error: payErr } = await admin.from("payment_records").insert({
    user_id: userId,
    stripe_session_id: idempotencyKey,
    stripe_payment_intent_id: invoicePaymentIntentId(invoice),
    plan_type: planType,
    quantity: 1,
    amount_cents: invoice.amount_paid ?? null,
    currency: invoice.currency ?? "usd",
    status: "completed",
  });

  if (payErr) {
    if (payErr.code === "23505") return;
    console.error("[webhooks/stripe] renewal payment_records", payErr.code);
    throw payErr;
  }

  const quota = SUBSCRIPTION_MONTHLY_QUOTA[planType];
  const { error: rpcErr } = await admin.rpc("topup_subscription_passes", {
    target_user_id: userId,
    monthly_quota: quota,
    plan_name: planType,
  });

  if (rpcErr) {
    console.error("[webhooks/stripe] topup_subscription_passes", rpcErr.code);
    throw rpcErr;
  }
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  if (!isSupabaseAdminConfigured()) return;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  let userId = sub.metadata?.user_id?.trim() || null;
  if (!userId) userId = await resolveUserIdFromCustomer(customerId);
  if (!userId) {
    console.error("[webhooks/stripe] subscription event missing user", sub.id);
    return;
  }

  const metaPlan = sub.metadata?.plan_type;
  const plan =
    metaPlan === "personal" || metaPlan === "team"
      ? metaPlan
      : sub.status === "canceled" || sub.status === "unpaid"
        ? null
        : undefined;

  const status =
    sub.status === "active" || sub.status === "trialing"
      ? "active"
      : sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired"
        ? "canceled"
        : "none";

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("user_passes")
    .select("pending_subscription_plan")
    .eq("user_id", userId)
    .maybeSingle();
  const hasPending =
    existing?.pending_subscription_plan === "personal" ||
    existing?.pending_subscription_plan === "team";

  const patch: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    current_period_end: periodEndIso(sub),
    subscription_status: status,
    updated_at: new Date().toISOString(),
  };
  // Do not apply Stripe plan immediately when a next-cycle switch is scheduled.
  if (plan !== undefined && !hasPending) {
    patch.subscription_plan = plan;
  }

  await admin.from("user_passes").update(patch).eq("user_id", userId);
}

export async function POST(req: Request) {
  if (!isPaymentGatewayEnabled() || !isStripeConfigured()) {
    return NextResponse.json({ ok: true, ignored: true, reason: "gateway_off" });
  }

  const stripe = createStripeClient();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!signature || !webhookSecret) {
    return NextResponse.json({ ok: false, error: "missing_webhook_secret" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("[webhooks/stripe] signature", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.user_id;
      const planType = session.metadata?.plan_type || "flex_pass";
      const quantity = Number.parseInt(session.metadata?.quantity || "1", 10) || 1;

      if (!userId) {
        console.error("[webhooks/stripe] missing user id on session", session.id);
        return NextResponse.json({ ok: false, error: "missing_user" }, { status: 400 });
      }

      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (customerId && isSupabaseAdminConfigured()) {
        const admin = createSupabaseAdminClient();
        await admin
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", userId);
      }

      let subscriptionId: string | null = null;
      let currentPeriodEnd: string | null = null;
      if (typeof session.subscription === "string") {
        subscriptionId = session.subscription;
        try {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          currentPeriodEnd = periodEndIso(sub);
        } catch {
          /* ignore */
        }
      }

      await creditPasses({
        userId,
        planType,
        quantity,
        sessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
        amountCents: session.amount_total,
        currency: session.currency,
        subscriptionId,
        currentPeriodEnd,
      });
    } else if (event.type === "invoice.paid") {
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
    } else if (
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.updated"
    ) {
      await handleSubscriptionChange(event.data.object as Stripe.Subscription);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhooks/stripe] handler", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "handler_failed" }, { status: 500 });
  }
}
