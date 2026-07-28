import { NextResponse } from "next/server";

import { createSupabaseAdminClient, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/auth/supabase";
import { getServerUser } from "@/lib/auth/supabase-server";
import { createStripeClient, isStripeConfigured } from "@/lib/payments/create-checkout-session";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";

export const runtime = "nodejs";

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.VERCEL_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

/**
 * Stripe Customer Portal session for manage / cancel subscription.
 */
export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }

    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (!isPaymentGatewayEnabled() || !isStripeConfigured() || !isSupabaseAdminConfigured()) {
      return NextResponse.json({ ok: false, error: "portal_unavailable" }, { status: 503 });
    }

    const admin = createSupabaseAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[account/portal] profile", error.code);
      return NextResponse.json({ ok: false, error: "profile_lookup_failed" }, { status: 500 });
    }

    const customerId = profile?.stripe_customer_id?.trim();
    if (!customerId) {
      return NextResponse.json({ ok: false, error: "no_stripe_customer" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { locale?: string };
    const locale = typeof body.locale === "string" && body.locale.length >= 2 ? body.locale.slice(0, 2) : "en";
    const origin = siteOrigin().startsWith("http") ? siteOrigin() : `https://${siteOrigin()}`;
    const returnUrl = `${origin}/${locale}/app?tab=profile`;

    const stripe = createStripeClient();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    if (!portal.url) {
      return NextResponse.json({ ok: false, error: "portal_url_missing" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, portal_url: portal.url });
  } catch (error) {
    console.error("[account/portal]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "portal_failed" }, { status: 502 });
  }
}
