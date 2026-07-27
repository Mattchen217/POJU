import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/auth/supabase";
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
}) {
  if (!isSupabaseAdminConfigured()) {
    console.warn("[webhooks/stripe] Supabase admin not configured — skip credit", params.sessionId);
    return;
  }

  const admin = createSupabaseAdminClient();
  let passesToAdd = 0;
  let planName: string | null = null;

  if (params.planType === "flex_pass") {
    passesToAdd = Math.max(1, params.quantity);
  } else if (params.planType === "personal") {
    passesToAdd = 7;
    planName = "personal";
  } else if (params.planType === "team") {
    passesToAdd = 20;
    planName = "team";
  }

  const { error: payErr } = await admin.from("payment_records").insert({
    user_id: params.userId,
    stripe_session_id: params.sessionId,
    stripe_payment_intent_id: params.paymentIntentId ?? null,
    plan_type: params.planType,
    quantity: params.quantity,
    amount_cents: params.amountCents ?? null,
    currency: params.currency ?? "usd",
    status: "completed",
  });

  if (payErr) {
    // Unique violation → already processed
    if (payErr.code === "23505") return;
    console.error("[webhooks/stripe] payment_records insert", payErr.code);
    throw payErr;
  }

  const { error: rpcErr } = await admin.rpc("increment_user_passes", {
    target_user_id: params.userId,
    passes_num: passesToAdd,
    plan_name: planName,
  });

  if (rpcErr) {
    console.error("[webhooks/stripe] increment_user_passes", rpcErr.code);
    throw rpcErr;
  }
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

      await creditPasses({
        userId,
        planType,
        quantity,
        sessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
        amountCents: session.amount_total,
        currency: session.currency,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhooks/stripe] handler", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "handler_failed" }, { status: 500 });
  }
}
