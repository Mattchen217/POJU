import { NextResponse } from "next/server";
import { z } from "zod";

import { PendingIntentSchema } from "@/lib/auth/pending-intent";
import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { createCheckoutSession } from "@/lib/payments/create-checkout-session";

const BodySchema = z.object({
  intent: PendingIntentSchema,
  locale: z.string().min(2).max(16).optional(),
  /** @deprecated Ignored when Cookie session is present — kept for older clients. */
  user_id: z.string().min(1).optional(),
  /** @deprecated Ignored when Cookie session is present. */
  email: z.string().email().optional(),
  access_token: z.string().min(1).optional(),
});

/**
 * Create Stripe Checkout (or mock redirect) for a remembered pricing intent.
 * User identity comes from Cookie session via `getServerUser()` — not from the body.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const { intent, locale } = parsed.data;
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

    const result = await createCheckoutSession({
      intent,
      userId,
      email,
      locale: locale ?? "en",
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
