import Stripe from "stripe";

import {
  PLAN_PRICES_CENTS,
  type PendingIntent,
  normalizePlanType,
  passesForCheckout,
} from "@/lib/auth/pending-intent";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.VERCEL_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
}

export type CheckoutCreateResult = {
  checkout_url: string;
  session_id: string;
  mocked?: boolean;
};

export async function createCheckoutSession(params: {
  intent: PendingIntent;
  userId: string;
  email: string;
  locale?: string;
}): Promise<CheckoutCreateResult> {
  const { intent, userId, email, locale = "en" } = params;
  const planType = normalizePlanType(intent.plan);
  const quantity = intent.plan === "flex_pass" ? Math.max(1, intent.quantity ?? 1) : 1;
  const unitAmount = PLAN_PRICES_CENTS[intent.plan];
  const passes = passesForCheckout(intent);
  const origin = siteOrigin().startsWith("http") ? siteOrigin() : `https://${siteOrigin()}`;
  const successUrl = `${origin}/${locale}/app?tab=atmos&checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/${locale}?ui=workspace#v2-pricing`;

  if (!isPaymentGatewayEnabled() || !isStripeConfigured()) {
    const mockId = `mock_cs_${Date.now().toString(36)}`;
    const mockUrl = `${origin}/${locale}/app?tab=atmos&checkout=mock&plan=${encodeURIComponent(planType)}&qty=${quantity}&passes=${passes}&session_id=${mockId}`;
    return { checkout_url: mockUrl, session_id: mockId, mocked: true };
  }

  const stripe = createStripeClient();
  const mode = intent.plan === "flex_pass" ? "payment" : "subscription";

  const productName =
    intent.plan === "personal_plan"
      ? "Eastern OS Personal Plan"
      : intent.plan === "team_plan"
        ? "Eastern OS Family / Team Plan"
        : "Eastern OS Flex Pass";

  const productDescription =
    intent.plan === "personal_plan"
      ? "5 Passes / month + limited-time +2 bonus (7 first month)"
      : intent.plan === "team_plan"
        ? "15 Passes / month + limited-time +5 bonus (20 first month)"
        : `${quantity} Pass${quantity === 1 ? "" : "es"} — valid across Atmos / Pivot / Match / Syncro / Glyph`;

  const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
    currency: "usd",
    unit_amount: unitAmount,
    product_data: {
      name: productName,
      description: productDescription,
    },
  };

  if (mode === "subscription") {
    priceData.recurring = { interval: "month" };
  }

  const session = await stripe.checkout.sessions.create({
    mode,
    customer_email: email,
    client_reference_id: userId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      plan_type: planType,
      quantity: String(quantity),
      passes: String(passes),
      user_id: userId,
    },
    line_items: [
      {
        quantity,
        price_data: priceData,
      },
    ],
  });

  if (!session.url) {
    throw new Error("Stripe session missing url");
  }

  return { checkout_url: session.url, session_id: session.id };
}
