import { NextResponse } from "next/server";
import { z } from "zod";

import { PendingIntentSchema } from "@/lib/auth/pending-intent";
import { createCheckoutSession } from "@/lib/payments/create-checkout-session";

const BodySchema = z.object({
  intent: PendingIntentSchema,
  user_id: z.string().min(1),
  email: z.string().email(),
  access_token: z.string().min(1).optional(),
  locale: z.string().min(2).max(16).optional(),
});

/**
 * Create Stripe Checkout (or mock redirect) for a remembered pricing intent.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const { intent, user_id, email, locale } = parsed.data;
    const result = await createCheckoutSession({
      intent,
      userId: user_id,
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
