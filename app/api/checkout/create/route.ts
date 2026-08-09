import { NextResponse } from "next/server";
import { z } from "zod";

import { PendingIntentSchema } from "@/lib/auth/pending-intent";
import { getServerUser, createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { createCheckoutSession } from "@/lib/payments/create-checkout-session";

const BodySchema = z.object({
  intent: PendingIntentSchema,
  locale: z.string().min(2).max(16).optional(),
  /** Resume path after payment (pathname+search). Prefer over intent.return_path. */
  return_path: z.string().min(1).max(512).optional(),
  /** @deprecated Ignored when Cookie session is present — kept for older clients. */
  user_id: z.string().min(1).optional(),
  /** @deprecated Ignored when Cookie session is present. */
  email: z.string().email().optional(),
  access_token: z.string().min(1).optional(),
});

/**
 * Create Stripe Checkout (or mock redirect) for a remembered pricing intent.
 * User identity comes from Cookie session via `getServerUser()` — not from the body.
 * Existing subscribers may checkout a *different* plan (immediate upgrade/downgrade).
 * Same-plan resubscribe is blocked.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const { intent, locale, return_path } = parsed.data;
    const sessionUser = await getServerUser();

    let userId: string;
    let email: string;

    if (sessionUser?.id && sessionUser.email) {
      userId = sessionUser.id;
      email = sessionUser.email;
    } else if (!isSupabaseConfigured()) {
      // Local UI without Supabase: allow mock checkout only.
      userId = parsed.data.user_id ?? "mock-local-user";
      email = parsed.data.email ?? "mock@localhost";
    } else {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (
      isSupabaseConfigured() &&
      sessionUser?.id &&
      (intent.plan === "personal_plan" || intent.plan === "team_plan")
    ) {
      const supabase = await createSupabaseServerClient();
      const { data: passes } = await supabase
        .from("user_passes")
        .select("subscription_status, subscription_plan, stripe_subscription_id")
        .eq("user_id", userId)
        .maybeSingle();
      const currentPlan =
        passes?.subscription_plan === "personal" || passes?.subscription_plan === "team"
          ? passes.subscription_plan
          : null;
      const hasSub =
        passes?.subscription_status === "active" ||
        Boolean(currentPlan) ||
        Boolean(passes?.stripe_subscription_id?.trim());
      const targetPlan = intent.plan === "personal_plan" ? "personal" : "team";
      if (hasSub && currentPlan === targetPlan) {
        return NextResponse.json(
          { ok: false, error: "already_on_plan" },
          { status: 409 },
        );
      }
    }

    const result = await createCheckoutSession({
      intent,
      userId,
      email,
      locale: locale ?? "en",
      return_path: return_path ?? intent.return_path,
    });

    return NextResponse.json({
      ok: true,
      checkout_url: result.checkout_url,
      session_id: result.session_id,
      mocked: Boolean(result.mocked),
    });
  } catch (error) {
    console.error("[checkout/create]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "checkout_failed" }, { status: 502 });
  }
}
