import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseAdminConfigured } from "@/lib/auth/supabase";
import { PLAN_PRICES_CENTS, type PendingIntentPlan } from "@/lib/auth/pending-intent";
import { creditPassesFromCheckout } from "@/lib/passes/credit-passes";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";
import { createStripeClient, isStripeConfigured } from "@/lib/payments/create-checkout-session";

export const runtime = "nodejs";

/**
 * Confirm checkout and credit Passes.
 * - Mock / gateway-off: treat as paid (Stripe placeholder path).
 * - Real Stripe success: credit if webhook has not yet (idempotent).
 */
const BodySchema = z.object({
  session_id: z.string().min(1),
  plan: z.enum(["flex_pass", "personal", "team", "personal_plan", "team_plan"]).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  mocked: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ ok: false, error: "admin_unconfigured" }, { status: 503 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const { session_id: sessionId, mocked } = parsed.data;
    const gatewayLive = isPaymentGatewayEnabled() && isStripeConfigured();

    // ── Stripe placeholder: mock / gateway off → default paid ──
    if (mocked || sessionId.startsWith("mock_cs_") || !gatewayLive) {
      const planRaw = parsed.data.plan ?? "flex_pass";
      const planType =
        planRaw === "personal_plan" || planRaw === "personal"
          ? "personal"
          : planRaw === "team_plan" || planRaw === "team"
            ? "team"
            : "flex_pass";
      const quantity = parsed.data.quantity ?? 1;
      const intentPlan: PendingIntentPlan =
        planType === "personal"
          ? "personal_plan"
          : planType === "team"
            ? "team_plan"
            : "flex_pass";
      const amount =
        planType === "flex_pass"
          ? PLAN_PRICES_CENTS.flex_pass * quantity
          : PLAN_PRICES_CENTS[intentPlan];

      const result = await creditPassesFromCheckout({
        userId: user.id,
        planType,
        quantity,
        sessionId,
        amountCents: amount,
        currency: "usd",
        currentPeriodEnd:
          planType === "flex_pass"
            ? null
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (!result.ok && result.reason !== "already_credited") {
        return NextResponse.json(
          { ok: false, error: result.reason ?? "credit_failed" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        mocked: true,
        gateway_placeholder: true,
        already: Boolean(result.already),
        flex_balance: result.flexAfter,
        sub_balance: result.subAfter,
        pass_balance: result.totalAfter,
      });
    }

    // ── Real Stripe: verify session belongs to user, then credit (idempotent) ──
    const stripe = createStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionUser =
      session.client_reference_id || session.metadata?.user_id || "";
    if (sessionUser !== user.id) {
      return NextResponse.json({ ok: false, error: "session_mismatch" }, { status: 403 });
    }
    if (session.payment_status !== "paid" && session.status !== "complete") {
      return NextResponse.json({ ok: false, error: "not_paid" }, { status: 402 });
    }

    const planType = session.metadata?.plan_type || "flex_pass";
    const quantity = Number.parseInt(session.metadata?.quantity || "1", 10) || 1;
    let currentPeriodEnd: string | null = null;
    let subscriptionId: string | null = null;
    if (typeof session.subscription === "string") {
      subscriptionId = session.subscription;
      try {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const end = sub.items?.data?.[0]?.current_period_end;
        if (typeof end === "number") {
          currentPeriodEnd = new Date(end * 1000).toISOString();
        }
      } catch {
        /* ignore */
      }
    }

    const result = await creditPassesFromCheckout({
      userId: user.id,
      planType,
      quantity,
      sessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id,
      amountCents: session.amount_total,
      currency: session.currency,
      subscriptionId,
      currentPeriodEnd,
    });

    if (!result.ok && result.reason !== "already_credited") {
      return NextResponse.json(
        { ok: false, error: result.reason ?? "credit_failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      mocked: false,
      already: Boolean(result.already),
      flex_balance: result.flexAfter,
      sub_balance: result.subAfter,
      pass_balance: result.totalAfter,
    });
  } catch (error) {
    console.error("[checkout/confirm]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "confirm_failed" }, { status: 500 });
  }
}
