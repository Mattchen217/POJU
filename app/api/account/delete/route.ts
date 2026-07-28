import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/auth/supabase";
import { getServerUser } from "@/lib/auth/supabase-server";
import { createStripeClient, isStripeConfigured } from "@/lib/payments/create-checkout-session";
import { isPaymentGatewayEnabled } from "@/lib/payments/gateway-enabled";

export const runtime = "nodejs";

const BodySchema = z.object({
  confirm: z.literal("DELETE"),
});

/**
 * Permanently delete the signed-in account (auth user + cascaded rows).
 * Best-effort Stripe subscription cancel when gateway is on.
 */
export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }

    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    if (isPaymentGatewayEnabled() && isStripeConfigured()) {
      try {
        const { data: passes } = await admin
          .from("user_passes")
          .select("stripe_subscription_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const subId = passes?.stripe_subscription_id?.trim();
        if (subId) {
          const stripe = createStripeClient();
          await stripe.subscriptions.cancel(subId);
        }
      } catch (stripeError) {
        console.error(
          "[account/delete] stripe cancel",
          stripeError instanceof Error ? stripeError.name : "unknown",
        );
      }
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("[account/delete]", error.name, error.message);
      return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
    }

    const res = NextResponse.json({ ok: true });
    // Clear auth cookies best-effort (names vary by project URL hash).
    for (const cookie of [
      "sb-access-token",
      "sb-refresh-token",
    ]) {
      res.cookies.set(cookie, "", { path: "/", maxAge: 0 });
    }
    return res;
  } catch (error) {
    console.error("[account/delete] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }
}
