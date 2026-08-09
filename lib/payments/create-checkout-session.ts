import Stripe from "stripe";

import {
  PLAN_PRICES_CENTS,
  type PendingIntent,
  normalizePlanType,
  passesForCheckout,
} from "@/lib/auth/pending-intent";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";
import {
  appendCheckoutResultQuery,
  defaultCheckoutReturnPath,
  sanitizeCheckoutReturnPath,
} from "@/lib/passes/checkout-return-path";

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

async function ensureStripeCustomer(params: {
  stripe: Stripe;
  userId: string;
  email: string;
}): Promise<string> {
  const { stripe, userId, email } = params;

  if (isSupabaseAdminConfigured()) {
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();
    const existing = profile?.stripe_customer_id?.trim();
    if (existing) return existing;
  }

  const listed = await stripe.customers.list({ email, limit: 1 });
  let customerId = listed.data[0]?.id;
  if (!customerId) {
    const created = await stripe.customers.create({
      email,
      metadata: { user_id: userId },
    });
    customerId = created.id;
  }

  if (isSupabaseAdminConfigured()) {
    const admin = createSupabaseAdminClient();
    await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        stripe_customer_id: customerId,
      },
      { onConflict: "id" },
    );
  }

  return customerId;
}

export async function createCheckoutSession(params: {
  intent: PendingIntent;
  userId: string;
  email: string;
  locale?: string;
  /** Pathname+search to resume after payment (paywall page). Defaults to account tab. */
  return_path?: string;
}): Promise<CheckoutCreateResult> {
  const { intent, userId, email, locale = "en" } = params;
  const planType = normalizePlanType(intent.plan);
  const quantity = intent.plan === "flex_pass" ? Math.max(1, intent.quantity ?? 1) : 1;
  const unitAmount = PLAN_PRICES_CENTS[intent.plan];
  const passes = passesForCheckout(intent);
  const origin = siteOrigin().startsWith("http") ? siteOrigin() : `https://${siteOrigin()}`;
  const returnPath = sanitizeCheckoutReturnPath(
    params.return_path ?? intent.return_path ?? defaultCheckoutReturnPath(locale),
    locale,
  );
  const successPath = appendCheckoutResultQuery(returnPath, "success");
  const successUrl = `${origin}${successPath}`;
  const cancelUrl = `${origin}${returnPath}`;

  if (!isPaymentGatewayEnabled() || !isStripeConfigured()) {
    const mockId = `mock_cs_${Date.now().toString(36)}`;
    const mockPath = appendCheckoutResultQuery(returnPath, "mock", {
      session_id: mockId,
      plan: planType,
      qty: quantity,
      passes,
    });
    const mockUrl = `${origin}${mockPath}`;
    return { checkout_url: mockUrl, session_id: mockId, mocked: true };
  }

  const stripe = createStripeClient();
  const mode = intent.plan === "flex_pass" ? "payment" : "subscription";
  const customerId = await ensureStripeCustomer({ stripe, userId, email });

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
    customer: customerId,
    client_reference_id: userId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      plan_type: planType,
      quantity: String(quantity),
      passes: String(passes),
      user_id: userId,
    },
    ...(mode === "subscription"
      ? {
          subscription_data: {
            metadata: {
              user_id: userId,
              plan_type: planType,
            },
          },
        }
      : {}),
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
